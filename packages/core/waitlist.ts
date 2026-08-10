// Waitlist promotion — DOMAIN-MODEL §4 ("Waitlist promotion"). Covers only
// step 1 of that section: finding the earliest waitlisted registration and
// making it `offered`. Accepting or declining that offer (steps 2-4 —
// "creates a one-line registration_carts row", the swap-on-acceptance
// choice) is not built yet; this pass's scope is bounded by what the
// concurrency load test (ARCHITECTURE §12) actually exercises.
import { and, eq, sql } from "drizzle-orm";
import { registrations } from "@summerice/db";
import type { Tx } from "@summerice/db";
import { countActiveRegistrations, lockSlotCapacities, type Position } from "./capacity-lock.ts";

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
 */
export async function promoteWaitlist(tx: Tx, input: PromoteWaitlistInput): Promise<PromoteWaitlistResult> {
  const key = { slotId: input.slotId, position: input.position };
  const capacities = await lockSlotCapacities(tx, [key]);
  const cap = capacities.get(`${input.slotId}:${input.position}`);
  if (!cap) {
    throw new Error(`promoteWaitlist: no slot_capacities row for slot ${input.slotId} position ${input.position}`);
  }

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
