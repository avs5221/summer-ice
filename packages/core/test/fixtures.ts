// Minimal fixture builders for packages/core integration tests. Each
// insert supplies only what its table requires (see packages/db/schema/*)
// plus whatever the calling test cares about varying.
import { people, seasons, slotCapacities, slots } from "@summerice/db";
import type { Tx } from "@summerice/db";
import type { Position } from "../capacity-lock.ts";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** INSERT ... RETURNING always returns one row per row inserted; this just
 *  narrows the type away from `T | undefined` at the one seam where that's
 *  true by construction, with a real check rather than a blind assertion. */
function single<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error("fixtures: INSERT ... RETURNING produced no row");
  return row;
}

export async function makeSeason(tx: Tx, overrides: { offerWindowMinutes?: number } = {}) {
  return single(
    await tx
      .insert(seasons)
      .values({
        name: unique("test-season"),
        startDate: "2026-09-01",
        endDate: "2027-03-01",
        weekCount: 20,
        registrationOpensAt: new Date(),
        status: "registration_open",
        ...(overrides.offerWindowMinutes !== undefined
          ? { offerWindowMinutes: overrides.offerWindowMinutes }
          : {}),
      })
      .returning(),
  );
}

export async function makeSlot(
  tx: Tx,
  seasonId: string,
  overrides: { weekday?: number; sortOrder?: number } = {},
) {
  return single(
    await tx
      .insert(slots)
      .values({
        seasonId,
        weekday: overrides.weekday ?? 2,
        startTime: "20:00:00",
        endTime: "21:00:00",
        label: unique("Test Slot"),
        sessionType: "scrimmage",
        sortOrder: overrides.sortOrder ?? 1,
      })
      .returning(),
  );
}

export async function makeCapacity(
  tx: Tx,
  slotId: string,
  position: Position,
  capacity: number,
  seasonPriceCents = 15_000,
) {
  return single(
    await tx
      .insert(slotCapacities)
      .values({
        slotId,
        position,
        capacity,
        idealCapacity: capacity,
        seasonPriceCents,
        extrasPriceCents: 1_000,
      })
      .returning(),
  );
}

export async function makePerson(tx: Tx) {
  return single(
    await tx
      .insert(people)
      .values({
        fullName: unique("Test Player"),
        defaultPosition: "skater",
        status: "active",
      })
      .returning(),
  );
}

/** A season + one slot + a capacity row for one position, in one call —
 *  the common case for tests that only care about a single (slot, position). */
export async function makeSlotWithCapacity(
  tx: Tx,
  position: Position,
  capacity: number,
  opts: { seasonPriceCents?: number; offerWindowMinutes?: number } = {},
) {
  const season = await makeSeason(tx, { offerWindowMinutes: opts.offerWindowMinutes });
  const slot = await makeSlot(tx, season.id);
  const cap = await makeCapacity(tx, slot.id, position, capacity, opts.seasonPriceCents);
  return { season, slot, cap };
}
