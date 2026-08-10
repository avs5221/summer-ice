import assert from "node:assert/strict";
import { test } from "node:test";
import { slotCapacities } from "@summerice/db";
import { eq } from "drizzle-orm";
import { holdCart } from "../registration.ts";
import { promoteWaitlist } from "../waitlist.ts";
import { at, withRollback } from "./harness.ts";
import { makePerson, makeSlotWithCapacity } from "./fixtures.ts";

void test("promoteWaitlist: offers the earliest waitlisted registration when capacity opens", async () => {
  await withRollback(async (tx) => {
    const { slot, cap } = await makeSlotWithCapacity(tx, "skater", 0, { offerWindowMinutes: 90 });
    const alice = await makePerson(tx);
    const bob = await makePerson(tx);

    const aliceHold = await holdCart(tx, { personId: alice.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    await holdCart(tx, { personId: bob.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const aliceLine = at(aliceHold.lines, 0);
    assert.equal(aliceLine.outcome, "waitlisted");
    if (aliceLine.outcome !== "waitlisted") throw new Error("unreachable");

    // Capacity opens — the same effect a release freeing a spot would have
    // (capacity − taken going from 0 to positive), simulated directly here
    // since releaseRegistration is covered by its own test.
    await tx.update(slotCapacities).set({ capacity: 1 }).where(eq(slotCapacities.id, cap.id));

    const before = Date.now();
    const promoted = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.equal(promoted.outcome, "offered");
    if (promoted.outcome === "offered") {
      assert.equal(promoted.registrationId, aliceLine.registrationId); // earliest joiner, not bob
      const minutesAhead = (promoted.offerExpiresAt.getTime() - before) / 60_000;
      assert.ok(minutesAhead > 89 && minutesAhead <= 90.5, `expected ~90 minutes, got ${minutesAhead}`);
    }
  });
});

void test("promoteWaitlist: no_capacity when nothing has actually opened", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 0);
    const alice = await makePerson(tx);
    await holdCart(tx, { personId: alice.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });

    const result = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.deepEqual(result, { outcome: "no_capacity" });
  });
});

void test("promoteWaitlist: empty_queue when capacity is open but nobody is waiting", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 5);
    const result = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.deepEqual(result, { outcome: "empty_queue" });
  });
});
