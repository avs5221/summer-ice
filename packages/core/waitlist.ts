// Waitlist promotion and offer resolution — DOMAIN-MODEL §4 ("Waitlist
// promotion"). Covers finding the earliest waitlisted registration and
// making it `offered` (promoteWaitlist), an active decline (declineOffer),
// and — folded into promoteWaitlist rather than a separate function — a
// lapsed offer being swept out of the queue. Accepting an offer ("creates
// a one-line registration_carts row", the swap-on-acceptance choice) is
// still not built: that's a payment-flow function belonging alongside
// holdCart/confirmCart, not a waitlist-mechanics one.
import { and, eq, sql } from "drizzle-orm";
import { registrations } from "@summerice/db";
import type { Tx } from "@summerice/db";
import { countActiveRegistrations, lockSlotCapacities, type Position } from "./capacity-lock.ts";
import { releaseRegistration } from "./registration.ts";

export interface PromoteWaitlistInput {
  slotId: string;
  position: Position;
}

export type PromoteWaitlistResult =
  | { outcome: "offered"; registrationId: string; offerExpiresAt: Date }
  | { outcome: "no_capacity" }
  | { outcome: "empty_queue" };

/**
 * Promotes exactly one registration per call — the earliest `waitlisted`
 * row for (slotId, position), ordered by waitlist_joined_at. If a release
 * freed more than one spot at once, the caller loops: call, check the
 * outcome, call again. Locks the capacity row first, so a concurrent
 * release or another promoteWaitlist call for the same (slot, position)
 * can't both act on the same just-opened spot.
 *
 * Also sweeps any `offered` row for this (slot, position) whose
 * offer_expires_at has lapsed to `withdrawn` — removed from the queue
 * entirely, not re-queued (settled 2026-08-10: an offer that's declined or
 * left to lapse takes the person out of the running; see declineOffer's
 * docstring for the fuller reasoning, which applies here too). This sweep
 * is bookkeeping, not a correctness dependency: countActiveRegistrations
 * already excludes a lapsed offer from "taken" regardless of its stored
 * status (ARCHITECTURE §4.2, computed not swept), so the capacity decision
 * below is correct with or without it. What the sweep buys is the row's
 * status matching reality, and — since it happens before the "find
 * earliest waitlisted" query just below — it's what lets an expired
 * offer's spot reach the *next* person in one promoteWaitlist call instead
 * of a second one. Doing it here, rather than a dedicated Cron sweep, is
 * deliberate: there's no outbox/Cron infrastructure yet (STATE.md), and
 * folding it into the function that's already touching this exact (slot,
 * position) under lock costs nothing extra.
 */
export async function promoteWaitlist(tx: Tx, input: PromoteWaitlistInput): Promise<PromoteWaitlistResult> {
  const key = { slotId: input.slotId, position: input.position };
  const capacities = await lockSlotCapacities(tx, [key]);
  const cap = capacities.get(`${input.slotId}:${input.position}`);
  if (!cap) {
    throw new Error(`promoteWaitlist: no slot_capacities row for slot ${input.slotId} position ${input.position}`);
  }

  await tx.execute(sql`
    update registrations
    set status = 'withdrawn', offer_expires_at = null
    where slot_id = ${input.slotId}
      and position = ${input.position}
      and status = 'offered'
      and offer_expires_at <= now()
  `);

  const activeCounts = await countActiveRegistrations(tx, [key]);
  const taken = activeCounts.get(`${input.slotId}:${input.position}`) ?? 0;
  if (cap.capacity - taken <= 0) {
    return { outcome: "no_capacity" };
  }

  const [next] = await tx
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.slotId, input.slotId),
        eq(registrations.position, input.position),
        eq(registrations.status, "waitlisted"),
      ),
    )
    .orderBy(registrations.waitlistJoinedAt)
    .limit(1)
    .for("update");

  if (!next) {
    return { outcome: "empty_queue" };
  }

  // offer_window_minutes lives on the season, not packages/core — see
  // migrations/0006_season_offer_window.sql. Admin-configurable, defaults
  // to 60.
  const [seasonRow] = (await tx.execute(sql`
    select se.offer_window_minutes as "offerWindowMinutes"
    from slots sl
    join seasons se on se.id = sl.season_id
    where sl.id = ${input.slotId}
  `)) as unknown as Array<{ offerWindowMinutes: number }>;
  if (!seasonRow) {
    throw new Error(`promoteWaitlist: no season found via slot ${input.slotId}`);
  }

  const offerExpiresAt = new Date(Date.now() + seasonRow.offerWindowMinutes * 60_000);

  await tx
    .update(registrations)
    .set({ status: "offered", offerExpiresAt })
    .where(eq(registrations.id, next.id));

  return { outcome: "offered", registrationId: next.id, offerExpiresAt };
}

export interface DeclineOfferInput {
  registrationId: string;
}

export type DeclineOfferResult =
  | { outcome: "declined"; registrationId: string; slotId: string; position: Position; promoted: PromoteWaitlistResult }
  | { outcome: "not_offered"; registrationId: string };

/**
 * An explicit "no thanks" to a waitlist offer — the active-user-action
 * counterpart to an offer silently lapsing, which promoteWaitlist's own
 * sweep handles instead (above). Human decision behind this function's
 * shape: "if a waitlist spot is declined or expires, it moves to the next
 * person in the waitlist" — so, unlike releaseRegistration (which
 * deliberately leaves promotion to the caller, since a withdrawal has many
 * call sites and not all of them want instant promotion), declineOffer
 * calls promoteWaitlist itself, in the same transaction. A decline has
 * exactly one purpose: free the spot for whoever's next.
 *
 * **Removes the decliner from the queue — does not re-add them.** Corrected
 * same-day: the first version re-queued the decliner at the back of the
 * waitlist, reasoning from DOMAIN-MODEL §4's diagram (which shows
 * `declined`/`offer_expired` looping back toward `waitlisted`). Direct
 * correction: "declining removes you from the queue, it shouldn't re-add
 * the person. That's not logical." Re-queuing was this codebase's own
 * misreading, not a real spec, so this now reuses releaseRegistration's
 * `offered` → `withdrawn` transition instead of writing a second one —
 * declining an offer is just a withdrawal that happens to be followed by
 * promoting whoever's next.
 */
export async function declineOffer(tx: Tx, input: DeclineOfferInput): Promise<DeclineOfferResult> {
  const [peek] = await tx
    .select({
      id: registrations.id,
      slotId: registrations.slotId,
      position: registrations.position,
      status: registrations.status,
    })
    .from(registrations)
    .where(eq(registrations.id, input.registrationId));

  if (!peek) {
    throw new Error(`declineOffer: no registrations row ${input.registrationId}`);
  }
  if (peek.status !== "offered") {
    return { outcome: "not_offered", registrationId: peek.id };
  }

  const position = peek.position as Position;
  const released = await releaseRegistration(tx, { registrationId: peek.id });
  if (released.outcome !== "withdrawn") {
    // Raced between the peek above and releaseRegistration's own check
    // (e.g. the offer lapsed and promoteWaitlist's sweep already withdrew
    // it) — nothing more to do.
    return { outcome: "not_offered", registrationId: peek.id };
  }

  const promoted = await promoteWaitlist(tx, { slotId: peek.slotId, position });
  return { outcome: "declined", registrationId: peek.id, slotId: peek.slotId, position, promoted };
}
