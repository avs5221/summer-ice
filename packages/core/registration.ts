// Season registration — hold, confirm, release. DOMAIN-MODEL §4, §7.
// Scope, deliberately: this is the concurrency core the load test
// (ARCHITECTURE §12, build order phase 3) gates on — capacity locking,
// mixed carts, waitlisting, confirmation, withdrawal. It does NOT gate
// season-registration-open windows, write ledger entries, or talk to
// Mollie — those are later phases (5, 6) layered on top by thin route
// handlers, per §4.1. It also does not implement accepting or declining a
// waitlist *offer* — see waitlist.ts's promoteWaitlist for what this pass
// does cover on that path.
import { and, eq, inArray, sql } from "drizzle-orm";
import { registrationCarts, registrations } from "@summerice/db";
import type { Tx } from "@summerice/db";
import { countActiveRegistrations, lockSlotCapacities, type Position } from "./capacity-lock.ts";

const HOLD_MINUTES_DEFAULT = 10; // Fixed, not per-season — ARCHITECTURE §7.

export interface HoldCartInput {
  personId: string;
  seasonId: string;
  lines: Array<{ slotId: string; position: Position }>;
  holdMinutes?: number;
}

export type CartLineOutcome =
  | { outcome: "held"; registrationId: string; slotId: string; position: Position; priceCents: number }
  | {
      outcome: "waitlisted";
      registrationId: string;
      slotId: string;
      position: Position;
      /** 1-based: this row's place in the queue, itself included. */
      queuePosition: number;
    }
  | { outcome: "already_registered"; slotId: string; position: Position };

export interface HoldCartResult {
  cartId: string;
  cartStatus: "open" | "paid";
  totalCents: number;
  expiresAt: Date;
  lines: CartLineOutcome[];
}

/**
 * The mixed-cart function (DOMAIN-MODEL §4, "The mixed cart"). Never fails
 * for a full slot — a line that can't be held is waitlisted instead, and
 * the cart always succeeds. Locks every (slot, position) the cart touches
 * in one call, in ascending order, before making any decision — that lock
 * is what makes "is there room" and "reserve it" atomic across every
 * concurrent caller.
 */
export async function holdCart(tx: Tx, input: HoldCartInput): Promise<HoldCartResult> {
  const holdMinutes = input.holdMinutes ?? HOLD_MINUTES_DEFAULT;
  const keys = input.lines.map((l) => ({ slotId: l.slotId, position: l.position }));

  const capacities = await lockSlotCapacities(tx, keys);
  const activeCounts = await countActiveRegistrations(tx, keys);

  // Pre-check duplicates for this person, so a re-selection of a slot
  // they're already held/offered/confirmed on comes back as a clean
  // outcome rather than a caught unique-violation. The unique partial
  // index (registrations_person_slot_position_active_unique,
  // ARCHITECTURE §4.4) is still the actual guarantee for the race this
  // read can't close — a concurrent second holdCart call for the same
  // person racing this one.
  const existing =
    input.lines.length === 0
      ? []
      : await tx
          .select({ slotId: registrations.slotId, position: registrations.position })
          .from(registrations)
          .where(
            and(
              eq(registrations.personId, input.personId),
              inArray(
                registrations.slotId,
                input.lines.map((l) => l.slotId),
              ),
              inArray(registrations.status, ["held", "offered", "confirmed"]),
            ),
          );
  const alreadyRegistered = new Set(existing.map((r) => `${r.slotId}:${r.position}`));

  const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000);
  const lines: CartLineOutcome[] = [];
  const toInsert: Array<{
    personId: string;
    slotId: string;
    position: Position;
    status: "held" | "waitlisted";
    priceCents: number;
    holdExpiresAt: Date | null;
    waitlistJoinedAt: Date | null;
  }> = [];

  for (const line of input.lines) {
    const key = `${line.slotId}:${line.position}`;
    // Includes lines already decided earlier in this same loop, in case a
    // malformed cart repeats a (slot, position) pair — see the comment in
    // lockSlotCapacities.
    if (alreadyRegistered.has(key)) {
      lines.push({ outcome: "already_registered", slotId: line.slotId, position: line.position });
      continue;
    }

    const cap = capacities.get(key);
    if (!cap) {
      throw new Error(`holdCart: no slot_capacities row for slot ${line.slotId} position ${line.position}`);
    }
    const taken = activeCounts.get(key) ?? 0;
    const available = cap.capacity - taken;

    if (available > 0) {
      toInsert.push({
        personId: input.personId,
        slotId: line.slotId,
        position: line.position,
        status: "held",
        priceCents: cap.seasonPriceCents,
        holdExpiresAt,
        waitlistJoinedAt: null,
      });
      // This line now occupies the spot it just claimed — decrement so a
      // later line in the same cart (a different slot/position, since one
      // person can't repeat a key, but sharing the same underlying
      // capacity row is impossible anyway) never double-counts. Kept for
      // defensiveness, not because a same-key repeat can legitimately
      // occur.
      activeCounts.set(key, taken + 1);
    } else {
      toInsert.push({
        personId: input.personId,
        slotId: line.slotId,
        position: line.position,
        status: "waitlisted",
        priceCents: cap.seasonPriceCents,
        holdExpiresAt: null,
        waitlistJoinedAt: new Date(),
      });
    }
    alreadyRegistered.add(key);
  }

  const totalCents = toInsert
    .filter((l) => l.status === "held")
    .reduce((sum, l) => sum + l.priceCents, 0);

  const hasHeldLines = toInsert.some((l) => l.status === "held");
  // A cart with nothing held has nothing to charge — skip the payment
  // state entirely rather than create an `open` cart that Mollie will
  // never see a webhook for. Judgment call, not a documented rule; revisit
  // if a pure-waitlist cart ever needs its own UI state.
  const cartStatus: "open" | "paid" = hasHeldLines ? "open" : "paid";

  const [cart] = await tx
    .insert(registrationCarts)
    .values({
      personId: input.personId,
      seasonId: input.seasonId,
      status: cartStatus,
      expiresAt: holdExpiresAt,
      totalCents,
    })
    .returning({ id: registrationCarts.id });
  if (!cart) {
    throw new Error("holdCart: INSERT ... RETURNING on registration_carts produced no row");
  }

  for (const row of toInsert) {
    const [inserted] = await tx
      .insert(registrations)
      .values({
        cartId: cart.id,
        personId: row.personId,
        slotId: row.slotId,
        position: row.position,
        status: row.status,
        priceCents: row.priceCents,
        holdExpiresAt: row.holdExpiresAt,
        waitlistJoinedAt: row.waitlistJoinedAt,
      })
      .returning({ id: registrations.id });
    if (!inserted) {
      throw new Error("holdCart: INSERT ... RETURNING on registrations produced no row");
    }

    if (row.status === "held") {
      lines.push({
        outcome: "held",
        registrationId: inserted.id,
        slotId: row.slotId,
        position: row.position,
        priceCents: row.priceCents,
      });
    } else {
      // Queue position: how many waitlisted rows for this (slot, position)
      // joined strictly before this one, plus itself. Safe under the
      // capacity-row lock this transaction already holds — every other
      // holdCart or promoteWaitlist call for the same key is serialised
      // behind the same lock.
      const [countRow] = (await tx.execute(sql`
        select count(*)::int as count
        from registrations
        where slot_id = ${row.slotId}
          and position = ${row.position}
          and status = 'waitlisted'
          and waitlist_joined_at <= ${row.waitlistJoinedAt!.toISOString()}
      `)) as unknown as Array<{ count: number }>;
      const count = countRow?.count ?? 0;

      lines.push({
        outcome: "waitlisted",
        registrationId: inserted.id,
        slotId: row.slotId,
        position: row.position,
        queuePosition: count,
      });
    }
  }

  return { cartId: cart.id, cartStatus, totalCents, expiresAt: holdExpiresAt, lines };
}

export interface ConfirmCartInput {
  cartId: string;
}

export type ConfirmCartResult =
  | { outcome: "confirmed"; cartId: string; confirmedRegistrationIds: string[] }
  | { outcome: "already_confirmed"; cartId: string }
  | { outcome: "cart_expired"; cartId: string };

/**
 * Called from the Mollie webhook handler (ARCHITECTURE §4.5) — never from
 * the return-URL page. Idempotent on cartId: Mollie retries, and a second
 * call for an already-paid cart is a no-op, not an error.
 *
 * Deliberately does NOT lock slot_capacities. A held or offered
 * registration already counts as "taken" in the availability formula
 * (§4.2); confirming it doesn't change that count, so there's nothing to
 * serialise against. What it does lock is the cart row itself, so two
 * concurrent webhook deliveries for the same payment can't both see
 * "open" and both try to transition it.
 */
export async function confirmCart(tx: Tx, input: ConfirmCartInput): Promise<ConfirmCartResult> {
  const [cart] = await tx
    .select({ id: registrationCarts.id, status: registrationCarts.status })
    .from(registrationCarts)
    .where(eq(registrationCarts.id, input.cartId))
    .for("update");

  if (!cart) {
    throw new Error(`confirmCart: no registration_carts row ${input.cartId}`);
  }
  if (cart.status === "paid") {
    return { outcome: "already_confirmed", cartId: cart.id };
  }
  if (cart.status === "expired") {
    // The hold lapsed before the payment webhook arrived. Known limitation
    // for this pass — no reconciliation (was the spot re-taken by someone
    // else? does this need a refund?) is implemented yet; the caller gets
    // a typed outcome to handle rather than a silent wrong confirmation.
    return { outcome: "cart_expired", cartId: cart.id };
  }

  const confirmed = await tx
    .update(registrations)
    .set({ status: "confirmed" })
    .where(and(eq(registrations.cartId, cart.id), inArray(registrations.status, ["held", "offered"])))
    .returning({ id: registrations.id });

  await tx.update(registrationCarts).set({ status: "paid" }).where(eq(registrationCarts.id, cart.id));

  return { outcome: "confirmed", cartId: cart.id, confirmedRegistrationIds: confirmed.map((r) => r.id) };
}

export interface ReleaseRegistrationInput {
  registrationId: string;
}

export type ReleaseRegistrationResult =
  | { outcome: "withdrawn"; registrationId: string; slotId: string; position: Position }
  | { outcome: "already_withdrawn"; registrationId: string };

/**
 * held / offered / confirmed / waitlisted → withdrawn. Deliberately does
 * NOT call promoteWaitlist itself — composability: a withdrawal that frees
 * a real spot (held/offered/confirmed, not waitlisted) is exactly when a
 * caller should follow this with promoteWaitlist, in the same
 * transaction, but that orchestration belongs to the caller (a future
 * withdrawal route or admin action), not fused into this function.
 */
export async function releaseRegistration(
  tx: Tx,
  input: ReleaseRegistrationInput,
): Promise<ReleaseRegistrationResult> {
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
    throw new Error(`releaseRegistration: no registrations row ${input.registrationId}`);
  }
  if (peek.status === "withdrawn" || peek.status === "expired") {
    return { outcome: "already_withdrawn", registrationId: peek.id };
  }

  // Lock the capacity row before touching the registration — this release
  // may free a spot, and the lock is what serialises that against a
  // concurrent holdCart or promoteWaitlist reading availability for the
  // same (slot, position). Waitlisted rows never counted as taken, so this
  // is a no-op lock in that case, but taking it unconditionally keeps the
  // rule uniform rather than special-cased per status.
  await lockSlotCapacities(tx, [{ slotId: peek.slotId, position: peek.position as Position }]);

  const [updated] = await tx
    .update(registrations)
    .set({ status: "withdrawn" })
    .where(and(eq(registrations.id, peek.id), inArray(registrations.status, ["held", "offered", "confirmed", "waitlisted"])))
    .returning({ id: registrations.id });

  if (!updated) {
    // Someone else withdrew it between the peek and the lock.
    return { outcome: "already_withdrawn", registrationId: peek.id };
  }
  return { outcome: "withdrawn", registrationId: peek.id, slotId: peek.slotId, position: peek.position as Position };
}
