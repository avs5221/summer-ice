// Integration tests against real local Postgres — no mocks. Run with
// `pnpm --filter @summerice/core test` (guarded to local-only, see
// package.json). Requires local Docker up (`pnpm db:up`) and migrated.
import assert from "node:assert/strict";
import { test } from "node:test";
import { registrationCarts, registrations } from "@summerice/db";
import { eq } from "drizzle-orm";
import { confirmCart, holdCart, releaseRegistration } from "../registration.ts";
import { makePerson, makeSlotWithCapacity } from "./fixtures.ts";
import { at, withRollback } from "./harness.ts";

void test("holdCart: single line with room becomes held, priced from the locked capacity row", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 20, { seasonPriceCents: 15_000 });
    const person = await makePerson(tx);

    const result = await holdCart(tx, {
      personId: person.id,
      seasonId: slot.seasonId,
      lines: [{ slotId: slot.id, position: "skater" }],
    });

    assert.equal(result.cartStatus, "open");
    assert.equal(result.totalCents, 15_000);
    assert.equal(result.lines.length, 1);
    const line = at(result.lines, 0);
    assert.equal(line.outcome, "held");
    if (line.outcome === "held") {
      assert.deepEqual(line, {
        outcome: "held",
        registrationId: line.registrationId,
        slotId: slot.id,
        position: "skater",
        priceCents: 15_000,
      });
    }
  });
});

void test("holdCart: a full slot waitlists instead of failing, and the cart never hard-fails", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 1);
    const first = await makePerson(tx);
    const second = await makePerson(tx);

    await holdCart(tx, { personId: first.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const result = await holdCart(tx, {
      personId: second.id,
      seasonId: slot.seasonId,
      lines: [{ slotId: slot.id, position: "skater" }],
    });

    assert.equal(result.lines.length, 1);
    assert.equal(at(result.lines, 0).outcome, "waitlisted");
    assert.equal(result.totalCents, 0); // waitlisted lines are free until promoted
    assert.equal(result.cartStatus, "paid"); // nothing to charge → no payment state
  });
});

void test("holdCart: mixed cart — one held line, one waitlisted line, one payable total", async () => {
  await withRollback(async (tx) => {
    const { slot: openSlot } = await makeSlotWithCapacity(tx, "skater", 20, { seasonPriceCents: 15_000 });
    const { slot: fullSlot } = await makeSlotWithCapacity(tx, "skater", 0, { seasonPriceCents: 12_000 });
    const person = await makePerson(tx);

    const result = await holdCart(tx, {
      personId: person.id,
      seasonId: openSlot.seasonId,
      lines: [
        { slotId: openSlot.id, position: "skater" },
        { slotId: fullSlot.id, position: "skater" },
      ],
    });

    assert.equal(result.cartStatus, "open");
    assert.equal(result.totalCents, 15_000); // only the held line
    const outcomes = result.lines.map((l) => l.outcome).sort();
    assert.deepEqual(outcomes, ["held", "waitlisted"]);
  });
});

void test("holdCart: waitlist queue position reflects arrival order", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "goalie", 0);
    const alice = await makePerson(tx);
    const bob = await makePerson(tx);

    const first = await holdCart(tx, { personId: alice.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "goalie" }] });
    const second = await holdCart(tx, { personId: bob.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "goalie" }] });

    const firstLine = at(first.lines, 0);
    const secondLine = at(second.lines, 0);
    assert.equal(firstLine.outcome, "waitlisted");
    assert.equal(secondLine.outcome, "waitlisted");
    if (firstLine.outcome === "waitlisted" && secondLine.outcome === "waitlisted") {
      assert.equal(firstLine.queuePosition, 1);
      assert.equal(secondLine.queuePosition, 2);
    }
  });
});

void test("holdCart: re-selecting an already-held slot comes back as already_registered, not a second hold", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 20);
    const person = await makePerson(tx);

    await holdCart(tx, { personId: person.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const second = await holdCart(tx, {
      personId: person.id,
      seasonId: slot.seasonId,
      lines: [{ slotId: slot.id, position: "skater" }],
    });

    assert.equal(at(second.lines, 0).outcome, "already_registered");
  });
});

void test("confirmCart: transitions held lines to confirmed and the cart to paid, idempotently", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 20);
    const person = await makePerson(tx);
    const held = await holdCart(tx, { personId: person.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });

    const confirmed = await confirmCart(tx, { cartId: held.cartId });
    assert.equal(confirmed.outcome, "confirmed");

    const registrationRows = await tx.select({ status: registrations.status }).from(registrations).where(eq(registrations.cartId, held.cartId));
    assert.equal(at(registrationRows, 0).status, "confirmed");
    const cartRows = await tx.select({ status: registrationCarts.status }).from(registrationCarts).where(eq(registrationCarts.id, held.cartId));
    assert.equal(at(cartRows, 0).status, "paid");

    // Idempotent: Mollie retries the webhook.
    const again = await confirmCart(tx, { cartId: held.cartId });
    assert.deepEqual(again, { outcome: "already_confirmed", cartId: held.cartId });
  });
});

void test("releaseRegistration: withdraws a held line and frees the spot for the next holdCart call", async () => {
  await withRollback(async (tx) => {
    const { slot } = await makeSlotWithCapacity(tx, "skater", 1);
    const first = await makePerson(tx);
    const second = await makePerson(tx);

    const firstHold = await holdCart(tx, { personId: first.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    const firstLine = at(firstHold.lines, 0);
    assert.equal(firstLine.outcome, "held");
    if (firstLine.outcome !== "held") throw new Error("unreachable");
    const registrationId = firstLine.registrationId;

    const released = await releaseRegistration(tx, { registrationId });
    assert.equal(released.outcome, "withdrawn");

    const secondHold = await holdCart(tx, { personId: second.id, seasonId: slot.seasonId, lines: [{ slotId: slot.id, position: "skater" }] });
    assert.equal(at(secondHold.lines, 0).outcome, "held"); // the spot the withdrawal freed

    const again = await releaseRegistration(tx, { registrationId });
    assert.deepEqual(again, { outcome: "already_withdrawn", registrationId });
  });
});
