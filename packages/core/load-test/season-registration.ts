// The concurrency load-test gate — ARCHITECTURE §12 ("The load test is a
// gate, not a nicety") and build order phase 3. Not a node:test file
// deliberately: this is expensive (hundreds of real committed
// transactions, real connections), described in ARCHITECTURE as "a
// dedicated load harness" distinct from packages/core's ordinary
// integration tests, and isn't meant to run on every `pnpm test` — it's
// run on demand, its own script, and it prints a pass/fail verdict with a
// non-zero exit code on failure so it *can* be wired into CI later without
// changes.
//
// Scenario, matching ARCHITECTURE §12/§7 exactly: several hundred
// concurrent multi-line carts, with overlapping slot sets, against a
// 20-capacity slot. Each contender is a distinct person (so "no duplicate
// registrations for one person on one slot and position" is structural,
// not just asserted) submitting a cart with the contested slot PLUS 1-2
// slots drawn from a small shared pool — small enough that many carts
// genuinely overlap on the same rows, real contention beyond just the one
// hot slot. Assertions:
//
//   - exactly HOT_CAPACITY held on the hot slot, never more
//   - every other contender waitlisted there, none dropped or duplicated
//   - zero rejected promises (no deadlocks, no unexpected errors)
//   - no partial baskets — every fulfilled result has exactly as many
//     outcome lines as the cart submitted
//   - the database's own counts agree with what holdCart reported, not
//     just the JS-side aggregation
//
// Run with: pnpm --filter @summerice/core run load-test
import { eq, inArray, sql } from "drizzle-orm";
import { dbDirectPooled, people, registrationCarts, registrations, seasons, slotCapacities, slots } from "@summerice/db";
import type { Tx } from "@summerice/db";
import { holdCart, type CartLineOutcome } from "../registration.ts";

const CONTENDERS = 300;
const HOT_CAPACITY = 20;
const COLD_SLOT_COUNT = 4;
// Real concurrent connections, not the postgres-js default of 10 — see
// dbDirectPooled's own docstring in packages/db/client.ts. Local
// Postgres's max_connections is 100; 50 seemed safe in isolation but
// wasn't in practice — a `next dev` server and a couple of psql sessions
// were enough to tip 50 over the edge into "sorry, too many clients
// already" errors on some of the 300 calls (a real failure this harness
// caught, just not the one it was built to catch). 30 leaves real
// headroom, and 30 genuinely concurrent transactions contending for one
// row is already a far heavier collision rate than a real registration
// rush produces per row — the property under test doesn't need literal
// hundreds of simultaneous sockets, just enough sustained contention to
// prove the lock holds, which the full 300-call batch still provides by
// cycling through the pool rather than all landing at once.
const POOL_MAX = 30;

interface Fixtures {
  seasonId: string;
  hotSlotId: string;
  coldSlotIds: string[];
  personIds: string[];
}

async function setup(tx: Tx): Promise<Fixtures> {
  const [season] = await tx
    .insert(seasons)
    .values({
      name: `load-test-${Date.now()}`,
      startDate: "2026-09-01",
      endDate: "2027-03-01",
      weekCount: 20,
      registrationOpensAt: new Date(),
      status: "registration_open",
    })
    .returning();
  if (!season) throw new Error("setup: season insert produced no row");

  const [hotSlot] = await tx
    .insert(slots)
    .values({
      seasonId: season.id,
      weekday: 2,
      startTime: "20:00:00",
      endTime: "21:00:00",
      label: "Load Test Hot Slot",
      sessionType: "scrimmage",
      sortOrder: 1,
    })
    .returning();
  if (!hotSlot) throw new Error("setup: hot slot insert produced no row");

  await tx.insert(slotCapacities).values({
    slotId: hotSlot.id,
    position: "skater",
    capacity: HOT_CAPACITY,
    idealCapacity: HOT_CAPACITY,
    seasonPriceCents: 15_000,
    extrasPriceCents: 1_500,
  });

  const coldSlotIds: string[] = [];
  for (let i = 0; i < COLD_SLOT_COUNT; i++) {
    const [coldSlot] = await tx
      .insert(slots)
      .values({
        seasonId: season.id,
        weekday: 3,
        startTime: `${19 + i}:00:00`,
        endTime: `${20 + i}:00:00`,
        label: `Load Test Cold Slot ${i}`,
        sessionType: "scrimmage",
        sortOrder: 2 + i,
      })
      .returning();
    if (!coldSlot) throw new Error(`setup: cold slot ${i} insert produced no row`);
    // Generous capacity — big enough that no contender ever waitlists here.
    // These rows exist purely to create genuine overlapping lock
    // contention across carts, not a second scarcity to assert on.
    await tx.insert(slotCapacities).values({
      slotId: coldSlot.id,
      position: "skater",
      capacity: CONTENDERS,
      idealCapacity: CONTENDERS,
      seasonPriceCents: 12_000,
      extrasPriceCents: 1_000,
    });
    coldSlotIds.push(coldSlot.id);
  }

  const personIds: string[] = [];
  for (let i = 0; i < CONTENDERS; i++) {
    const [person] = await tx
      .insert(people)
      .values({ fullName: `Load Test Contender ${i}`, defaultPosition: "skater", status: "active" })
      .returning();
    if (!person) throw new Error(`setup: person ${i} insert produced no row`);
    personIds.push(person.id);
  }

  return { seasonId: season.id, hotSlotId: hotSlot.id, coldSlotIds, personIds };
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Both indices are in bounds by construction (i counts down from
    // length - 1, j is 0..i) — the non-null assertions just tell
    // noUncheckedIndexedAccess what's already true here.
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

async function cleanup(tx: Tx, fixtures: Fixtures): Promise<void> {
  const cartRows = await tx
    .select({ id: registrationCarts.id })
    .from(registrationCarts)
    .where(inArray(registrationCarts.personId, fixtures.personIds));
  const cartIds = cartRows.map((c) => c.id);
  if (cartIds.length > 0) {
    await tx.delete(registrations).where(inArray(registrations.cartId, cartIds));
    await tx.delete(registrationCarts).where(inArray(registrationCarts.id, cartIds));
  }
  const allSlotIds = [fixtures.hotSlotId, ...fixtures.coldSlotIds];
  await tx.delete(slotCapacities).where(inArray(slotCapacities.slotId, allSlotIds));
  await tx.delete(slots).where(inArray(slots.id, allSlotIds));
  await tx.delete(seasons).where(eq(seasons.id, fixtures.seasonId));
  await tx.delete(people).where(inArray(people.id, fixtures.personIds));
}

async function main() {
  const db = dbDirectPooled(POOL_MAX);
  let fixtures: Fixtures | undefined;
  let failed = false;

  try {
    console.log(`[load-test] setting up: 1 season, 1 hot slot (capacity ${HOT_CAPACITY}), ${COLD_SLOT_COUNT} cold slots, ${CONTENDERS} people...`);
    fixtures = await db.transaction((tx) => setup(tx));

    // Each contender's cart: the hot slot, plus 1-2 slots drawn from the
    // cold pool, in random order. Built up front (not inside the
    // concurrent calls) so every cart's expected line count is known
    // ahead of time for the "no partial baskets" check below.
    const carts = fixtures.personIds.map((personId) => {
      const coldCount = 1 + Math.round(Math.random());
      const coldPicks = shuffled(fixtures!.coldSlotIds).slice(0, coldCount);
      const lines = shuffled([
        { slotId: fixtures!.hotSlotId, position: "skater" as const },
        ...coldPicks.map((slotId) => ({ slotId, position: "skater" as const })),
      ]);
      return { personId, lines };
    });

    console.log(`[load-test] firing ${carts.length} concurrent holdCart calls (pool max ${POOL_MAX})...`);
    const startedAt = Date.now();
    const settled = await Promise.allSettled(
      carts.map((cart) =>
        db.transaction((tx) =>
          holdCart(tx, { personId: cart.personId, seasonId: fixtures!.seasonId, lines: cart.lines }),
        ),
      ),
    );
    const elapsedMs = Date.now() - startedAt;
    console.log(`[load-test] done in ${elapsedMs}ms (${(carts.length / (elapsedMs / 1000)).toFixed(1)} carts/sec)`);

    // --- Assertions -------------------------------------------------
    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (rejected.length > 0) {
      failed = true;
      console.error(`[load-test] FAIL: ${rejected.length} rejected calls (expected 0 — no deadlocks, no errors)`);
      for (const r of rejected.slice(0, 5)) {
        console.error(`  - ${String(r.reason)}`);
      }
    } else {
      console.log(`[load-test] PASS: 0 rejected calls`);
    }

    // Zipped against `carts` by the ORIGINAL index, before any filtering —
    // Promise.allSettled preserves input order, but `carts[i]` only lines
    // up with a filtered array if the filter kept every index aligned,
    // which .filter() does not guarantee once any element is dropped.
    const fulfilled: Array<Awaited<ReturnType<typeof holdCart>>> = [];
    let partialBaskets = 0;
    settled.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      fulfilled.push(r.value);
      const expectedLineCount = carts[i]!.lines.length;
      if (r.value.lines.length !== expectedLineCount) partialBaskets++;
    });
    if (partialBaskets > 0) {
      failed = true;
      console.error(`[load-test] FAIL: ${partialBaskets} carts came back with a different line count than submitted (a partial basket)`);
    } else {
      console.log(`[load-test] PASS: 0 partial baskets`);
    }

    const hotOutcomes = fulfilled.flatMap((r) => r.lines.filter((l: CartLineOutcome) => l.slotId === fixtures!.hotSlotId));
    const heldCount = hotOutcomes.filter((l) => l.outcome === "held").length;
    const waitlistedCount = hotOutcomes.filter((l) => l.outcome === "waitlisted").length;

    if (heldCount === HOT_CAPACITY) {
      console.log(`[load-test] PASS: exactly ${HOT_CAPACITY} held on the hot slot`);
    } else {
      failed = true;
      console.error(`[load-test] FAIL: expected exactly ${HOT_CAPACITY} held on the hot slot, got ${heldCount}`);
    }

    const expectedWaitlisted = CONTENDERS - HOT_CAPACITY;
    if (waitlistedCount === expectedWaitlisted) {
      console.log(`[load-test] PASS: exactly ${expectedWaitlisted} waitlisted on the hot slot`);
    } else {
      failed = true;
      console.error(`[load-test] FAIL: expected exactly ${expectedWaitlisted} waitlisted on the hot slot, got ${waitlistedCount}`);
    }

    // Cross-check against the database directly — not just the JS-side
    // aggregation of what each call returned.
    const dbCounts = (await db.execute(sql`
      select status, count(*)::int as count
      from registrations
      where slot_id = ${fixtures.hotSlotId} and position = 'skater'
      group by status
    `)) as unknown as Array<{ status: string; count: number }>;
    const dbHeld = dbCounts.find((r) => r.status === "held")?.count ?? 0;
    const dbWaitlisted = dbCounts.find((r) => r.status === "waitlisted")?.count ?? 0;
    if (dbHeld === HOT_CAPACITY && dbWaitlisted === expectedWaitlisted) {
      console.log(`[load-test] PASS: database counts agree (held=${dbHeld}, waitlisted=${dbWaitlisted})`);
    } else {
      failed = true;
      console.error(`[load-test] FAIL: database counts disagree with call results (held=${dbHeld}, waitlisted=${dbWaitlisted})`);
    }

    const dupes = (await db.execute(sql`
      select person_id, slot_id, position, count(*)::int as count
      from registrations
      where status in ('held', 'offered', 'confirmed')
      group by person_id, slot_id, position
      having count(*) > 1
    `)) as unknown as unknown[];
    if (dupes.length === 0) {
      console.log(`[load-test] PASS: no duplicate active registrations for any (person, slot, position)`);
    } else {
      failed = true;
      console.error(`[load-test] FAIL: ${dupes.length} duplicate (person, slot, position) groups found`);
    }
  } finally {
    if (fixtures) {
      console.log("[load-test] cleaning up...");
      await db.transaction((tx) => cleanup(tx, fixtures!));
    }
    // A timeout, not the indefinite-wait default: a run with connection
    // errors can leave the pool holding sockets that never cleanly
    // resolve, and this script exits right after — better to force-close
    // within a few seconds than leak idle backends on the server (this
    // happened during development: a failed run left 58 idle connections
    // behind, confirmed via pg_stat_activity, until manually terminated).
    await db.$client.end({ timeout: 5 });
  }

  if (failed) {
    console.error("[load-test] FAILED — see above");
    process.exit(1);
  }
  console.log("[load-test] ALL PASSED");
}

main().catch((err) => {
  console.error("[load-test] crashed:", err);
  process.exit(1);
});
