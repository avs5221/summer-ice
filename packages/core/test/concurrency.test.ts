// A small real-concurrency proof, not the load-test gate itself.
// ARCHITECTURE §12's actual gate — several hundred concurrent multi-line
// carts — is a separate, dedicated harness, not a unit test; this is a
// fast sanity check that the row lock genuinely serialises independent
// connections before that bigger harness gets built. Can't use
// withRollback here: each concurrent holdCart call needs its own
// transaction on its own connection, which a single enclosing transaction
// can't provide. Cleans up explicitly instead.
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { people, registrationCarts, registrations, seasons, slotCapacities, slots } from "@summerice/db";
import { holdCart } from "../registration.ts";
import { makeCapacity, makePerson, makeSeason, makeSlot } from "./fixtures.ts";
import { at, testDb as db } from "./harness.ts";

void test("holdCart: N concurrent callers against a 1-capacity slot never oversell", async () => {
  const CONTENDERS = 8;
  const CAPACITY = 1;

  const { seasonId, slotId, personIds } = await db.transaction(async (tx) => {
    const season = await makeSeason(tx);
    const slot = await makeSlot(tx, season.id);
    await makeCapacity(tx, slot.id, "skater", CAPACITY);
    const contenders = await Promise.all(Array.from({ length: CONTENDERS }, () => makePerson(tx)));
    return { seasonId: season.id, slotId: slot.id, personIds: contenders.map((p) => p.id) };
  });

  try {
    const results = await Promise.all(
      personIds.map((personId) =>
        db.transaction((tx) =>
          holdCart(tx, { personId, seasonId, lines: [{ slotId, position: "skater" }] }),
        ),
      ),
    );

    const heldCount = results.filter((r) => at(r.lines, 0).outcome === "held").length;
    const waitlistedCount = results.filter((r) => at(r.lines, 0).outcome === "waitlisted").length;

    assert.equal(heldCount, CAPACITY, `expected exactly ${CAPACITY} held, got ${heldCount}`);
    assert.equal(waitlistedCount, CONTENDERS - CAPACITY);

    // Every waitlisted line got a distinct queue position — no two callers
    // landed on the same slot in the queue.
    const queuePositions = results
      .map((r) => at(r.lines, 0))
      .filter((l): l is Extract<typeof l, { outcome: "waitlisted" }> => l.outcome === "waitlisted")
      .map((l) => l.queuePosition)
      .sort((a, b) => a - b);
    assert.deepEqual(queuePositions, Array.from({ length: CONTENDERS - CAPACITY }, (_, i) => i + 1));
  } finally {
    await db.transaction(async (tx) => {
      const cartRows = await tx
        .select({ id: registrationCarts.id })
        .from(registrationCarts)
        .where(inArray(registrationCarts.personId, personIds));
      const cartIds = cartRows.map((c) => c.id);
      if (cartIds.length) {
        await tx.delete(registrations).where(inArray(registrations.cartId, cartIds));
        await tx.delete(registrationCarts).where(inArray(registrationCarts.id, cartIds));
      }
      await tx.delete(slotCapacities).where(eq(slotCapacities.slotId, slotId));
      await tx.delete(slots).where(eq(slots.id, slotId));
      await tx.delete(seasons).where(eq(seasons.id, seasonId));
      await tx.delete(people).where(inArray(people.id, personIds));
    });
  }
});
