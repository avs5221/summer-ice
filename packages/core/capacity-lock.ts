// The lock every capacity-mutating function in this package acquires
// first — docs/ARCHITECTURE.md §4.3, DOMAIN-MODEL §7, .claude/rules/core.md.
// Raw SQL here is the sanctioned exception in docs/ARCHITECTURE.md §5
// ("capacity and availability queries ... must be read as SQL to be
// reviewed properly").
import { sql } from "drizzle-orm";
import type { Tx } from "@summerice/db";

export type Position = "skater" | "goalie";

export interface SlotCapacityRow {
  id: string;
  slotId: string;
  position: Position;
  capacity: number;
  idealCapacity: number;
  seasonPriceCents: number;
  extrasPriceCents: number;
}

interface SlotCapacityDbRow {
  id: string;
  slot_id: string;
  position: Position;
  capacity: number;
  ideal_capacity: number;
  season_price_cents: number;
  extras_price_cents: number;
}

export function capacityKey(slotId: string, position: Position): string {
  return `${slotId}:${position}`;
}

/**
 * Locks the slot_capacities rows for the given (slotId, position) pairs, in
 * ascending (slot_id, position) order — the deterministic order
 * docs/ARCHITECTURE.md §4.3 requires so that two carts touching overlapping
 * slot sets in different orders can't deadlock. One statement, not one
 * query per key: `FOR UPDATE` locks rows in the order the executor produces
 * them, and for a single `ORDER BY ... FOR UPDATE` statement that order
 * *is* the sort order — the ORDER BY is the lock-order guarantee, not just
 * a display concern.
 *
 * Must be called inside the transaction that goes on to use the result —
 * the lock lives only as long as that transaction does. Every function in
 * this package that inserts or updates a registration's active status
 * (held, waitlisted → offered, or a release that frees a spot) calls this
 * first, for the (slot, position) pairs it's about to touch, before doing
 * anything else. Confirming an already-held or already-offered
 * registration is the one exception — see registration.ts's confirmCart
 * for why that doesn't change the taken count and so doesn't need it.
 */
export async function lockSlotCapacities(
  tx: Tx,
  keys: Array<{ slotId: string; position: Position }>,
): Promise<Map<string, SlotCapacityRow>> {
  if (keys.length === 0) return new Map();

  // Dedupe. A single (person, slot, position) is unique by construction, so
  // a well-formed cart never repeats a key — but defend against a
  // malformed one anyway rather than lock the same row twice for no
  // reason.
  const uniqueKeys = [...new Map(keys.map((k) => [capacityKey(k.slotId, k.position), k])).values()];

  const valuesList = sql.join(
    uniqueKeys.map((k) => sql`(${k.slotId}::uuid, ${k.position}::text)`),
    sql`, `,
  );

  const rows = (await tx.execute(sql`
    select sc.id, sc.slot_id, sc.position, sc.capacity, sc.ideal_capacity,
           sc.season_price_cents, sc.extras_price_cents
    from slot_capacities sc
    join (values ${valuesList}) as keys(slot_id, position)
      on sc.slot_id = keys.slot_id and sc.position = keys.position
    order by sc.slot_id, sc.position
    for update of sc
  `)) as unknown as SlotCapacityDbRow[];

  const result = new Map<string, SlotCapacityRow>();
  for (const row of rows) {
    result.set(capacityKey(row.slot_id, row.position), {
      id: row.id,
      slotId: row.slot_id,
      position: row.position,
      capacity: row.capacity,
      idealCapacity: row.ideal_capacity,
      seasonPriceCents: row.season_price_cents,
      extrasPriceCents: row.extras_price_cents,
    });
  }
  return result;
}

interface ActiveCountDbRow {
  slot_id: string;
  position: Position;
  active_count: number;
}

/**
 * Live "taken" count per (slot, position) — confirmed, plus not-yet-lapsed
 * holds and offers. Identical formula to getSlotFillOverview in
 * slot-fill.ts and the broadcast trigger in
 * packages/db/migrations/0005_live_fill_broadcast.sql; keep all three in
 * lockstep if the formula ever changes. Must be called after
 * lockSlotCapacities, inside the same transaction, so the count reflects a
 * state no concurrent writer can change out from under it.
 */
export async function countActiveRegistrations(
  tx: Tx,
  keys: Array<{ slotId: string; position: Position }>,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (keys.length === 0) return result;

  const uniqueKeys = [...new Map(keys.map((k) => [capacityKey(k.slotId, k.position), k])).values()];
  for (const k of uniqueKeys) result.set(capacityKey(k.slotId, k.position), 0);

  const valuesList = sql.join(
    uniqueKeys.map((k) => sql`(${k.slotId}::uuid, ${k.position}::text)`),
    sql`, `,
  );

  const rows = (await tx.execute(sql`
    select keys.slot_id, keys.position, count(r.id)::int as active_count
    from (values ${valuesList}) as keys(slot_id, position)
    left join registrations r
      on r.slot_id = keys.slot_id
     and r.position = keys.position
     and (
       r.status = 'confirmed'
       or (r.status = 'held' and r.hold_expires_at > now())
       or (r.status = 'offered' and r.offer_expires_at > now())
     )
    group by keys.slot_id, keys.position
  `)) as unknown as ActiveCountDbRow[];

  for (const row of rows) {
    result.set(capacityKey(row.slot_id, row.position), row.active_count);
  }
  return result;
}
