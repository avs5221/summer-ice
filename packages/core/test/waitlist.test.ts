import assert from "node:assert/strict";
import { test } from "node:test";
import { registrations, slotCapacities } from "@summerice/db";
import { eq } from "drizzle-orm";
import { holdCart } from "../registration.ts";
import { declineOffer, promoteWaitlist } from "../waitlist.ts";
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

void test("declineOffer: moves the spot to the next person in the waitlist, and removes the decliner from the queue", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 0);
    const alice = await makePerson(tx);
    const bob = await makePerson(tx);

    await holdCart(tx, { personId: alice.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const bobHold = await holdCart(tx, { personId: bob.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });

    await tx.update(slotCapacities).set({ capacity: 1 }).where(eq(slotCapacities.slotId, slot.id));
    const offered = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.equal(offered.outcome, "offered");
    if (offered.outcome !== "offered") throw new Error("unreachable");

    const aliceRegistrationId = offered.registrationId; // earliest joiner

    const declined = await declineOffer(tx, { registrationId: aliceRegistrationId });
    assert.equal(declined.outcome, "declined");
    if (declined.outcome !== "declined") throw new Error("unreachable");

    // Bob — next in line — got the offer, in the same call.
    assert.equal(declined.promoted.outcome, "offered");
    if (declined.promoted.outcome === "offered") {
      const bobLine = at(bobHold.lines, 0);
      assert.equal(bobLine.outcome, "waitlisted");
      if (bobLine.outcome === "waitlisted") {
        assert.equal(declined.promoted.registrationId, bobLine.registrationId);
      }
    }

    // Alice is OUT — withdrawn, not re-queued. Declining removes you from
    // the waitlist; it doesn't send you to the back of it.
    const aliceRow = await tx.select({ status: registrations.status }).from(registrations).where(eq(registrations.id, aliceRegistrationId));
    assert.equal(at(aliceRow, 0).status, "withdrawn");

    // Bob's offer is still consuming the slot's only spot — capacity, not
    // queue, is what blocks a third call here. Alice being gone rather
    // than re-queued doesn't change that; there's nobody else waiting
    // either way.
    const nextPromotion = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.deepEqual(nextPromotion, { outcome: "no_capacity" });
  });
});

void test("declineOffer: not_offered when the registration isn't currently offered", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 20);
    const person = await makePerson(tx);
    const held = await holdCart(tx, { personId: person.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const line = at(held.lines, 0);
    assert.equal(line.outcome, "held");
    if (line.outcome !== "held") throw new Error("unreachable");

    const result = await declineOffer(tx, { registrationId: line.registrationId });
    assert.deepEqual(result, { outcome: "not_offered", registrationId: line.registrationId });
  });
});

void test("promoteWaitlist: sweeps a lapsed offer out of the queue and promotes the next person", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 0);
    const alice = await makePerson(tx);
    const bob = await makePerson(tx);

    await holdCart(tx, { personId: alice.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const bobHold = await holdCart(tx, { personId: bob.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });

    await tx.update(slotCapacities).set({ capacity: 1 }).where(eq(slotCapacities.slotId, slot.id));
    const offered = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.equal(offered.outcome, "offered");
    if (offered.outcome !== "offered") throw new Error("unreachable");

    // Simulate the offer lapsing — nobody responded before offer_expires_at.
    await tx
      .update(registrations)
      .set({ offerExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(registrations.id, offered.registrationId));

    const nextPromotion = await promoteWaitlist(tx, { slotId: slot.id, position: "skater" });
    assert.equal(nextPromotion.outcome, "offered");
    if (nextPromotion.outcome === "offered") {
      const bobLine = at(bobHold.lines, 0);
      assert.equal(bobLine.outcome, "waitlisted");
      if (bobLine.outcome === "waitlisted") {
        assert.equal(nextPromotion.registrationId, bobLine.registrationId); // not Alice — her offer just lapsed
      }
    }

    const aliceRow = await tx
      .select({ status: registrations.status })
      .from(registrations)
      .where(eq(registrations.id, offered.registrationId));
    assert.equal(at(aliceRow, 0).status, "withdrawn"); // swept out, not left dangling as "offered"
  });
});
