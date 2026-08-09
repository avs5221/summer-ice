// Seeds reference data and the real 2026 season, per docs/DOMAIN-MODEL.md
// §1 ("The actual 2026 slots" — use this, not an invented schedule) and §2
// (levels). Idempotent — safe to re-run, via ON CONFLICT DO NOTHING keyed
// on each table's unique constraint.
//
// Deliberately does NOT seed ice_sessions / ice_session_capacities /
// session_coaches, or any people/credentials/roles rows — generating 22
// weeks x 10 slots of dated occurrences is a date-generation algorithm
// (domain logic), out of scope for a schema-and-seed-only session.
//
//   pnpm db:seed
import { eq } from "drizzle-orm";
import { createDb } from "./client.ts";
import {
  levels,
  seasons,
  slotCapacities,
  slotLevels,
  slots,
} from "./schema/index.ts";

// Individual ijshockey.nl divisions, per DOMAIN-MODEL §2 ("name —
// ijshockey.nl division naming"). NOT combined into "2nd/3rd"-style rows:
// DOMAIN-MODEL §3 says slot_levels is many-to-many "because '5th/6th
// Division' covers two" — i.e. a compound slot label links to TWO separate
// level rows, which only works if the underlying levels are single
// divisions. Rank orders by competitiveness, most to least; Recreational
// and Skills sit below the numbered divisions.
const REAL_LEVELS: Array<{ name: string; rank: number }> = [
  { name: "2nd", rank: 1 },
  { name: "3rd", rank: 2 },
  { name: "4th", rank: 3 },
  { name: "5th", rank: 4 },
  { name: "6th", rank: 5 },
  { name: "Recreational", rank: 6 },
  { name: "Skills", rank: 7 },
];

const SEASON_2026 = {
  name: "2026",
  startDate: "2026-03-30",
  endDate: "2026-08-30",
  weekCount: 22,
  // ~January, per DOMAIN-MODEL §1. 09:00 Europe/Amsterdam (CET, UTC+1) in
  // early January.
  registrationOpensAt: new Date("2026-01-05T08:00:00Z"),
  // Today (per this repo's dated context) falls between start and end.
  status: "active",
};

// The real, published 2026 schedule, per DOMAIN-MODEL.md §1 "The actual
// 2026 slots" — use this table verbatim, not an invented distribution.
// Ordered weekday-then-time, matching how the public schedule reads and
// matching the table's own row order.
//
// levelNames has TWO entries for every compound-named slot ("5th/6th
// Division", "3rd/4th Division", "2nd/3rd Division") — see the levels
// comment above. Only Recreational and Skills Training map to one.
const SLOT_DEFS: Array<{
  weekday: number; // ISO: 1 = Monday .. 7 = Sunday
  startTime: string;
  endTime: string;
  label: string;
  sessionType: "scrimmage" | "skills_training";
  levelNames: string[];
}> = [
  { weekday: 2, startTime: "21:30", endTime: "22:30", label: "5th/6th Division", sessionType: "scrimmage", levelNames: ["5th", "6th"] },
  { weekday: 3, startTime: "20:15", endTime: "21:15", label: "Skills Training", sessionType: "skills_training", levelNames: ["Skills"] },
  { weekday: 3, startTime: "21:30", endTime: "22:30", label: "Recreational", sessionType: "scrimmage", levelNames: ["Recreational"] },
  { weekday: 4, startTime: "20:15", endTime: "21:15", label: "3rd/4th Division", sessionType: "scrimmage", levelNames: ["3rd", "4th"] },
  { weekday: 4, startTime: "21:30", endTime: "22:30", label: "5th/6th Division", sessionType: "scrimmage", levelNames: ["5th", "6th"] },
  { weekday: 5, startTime: "20:15", endTime: "21:15", label: "3rd/4th Division", sessionType: "scrimmage", levelNames: ["3rd", "4th"] },
  { weekday: 5, startTime: "21:30", endTime: "22:30", label: "5th/6th Division", sessionType: "scrimmage", levelNames: ["5th", "6th"] },
  { weekday: 6, startTime: "20:15", endTime: "21:15", label: "Skills Training", sessionType: "skills_training", levelNames: ["Skills"] },
  { weekday: 6, startTime: "21:30", endTime: "22:30", label: "Recreational", sessionType: "scrimmage", levelNames: ["Recreational"] },
  { weekday: 7, startTime: "19:00", endTime: "20:00", label: "2nd/3rd Division", sessionType: "scrimmage", levelNames: ["2nd", "3rd"] },
];
// Distribution check (DOMAIN-MODEL §1): 3x 5th/6th, 2x 3rd/4th,
// 2x Skills Training, 2x Recreational, 1x 2nd/3rd = 10.

// Ground truth, DOMAIN-MODEL §1. Extras prices apply regardless of slot
// type — the ground truth table only differentiates season price by
// scrimmage vs skills training, not extras price.
//
// Scrimmage capacity (20 skaters / 2 goalies) is confirmed. Skills Training
// capacity is NOT: DOMAIN-MODEL §1 / §14 D12 records it as an open question
// — split ice means 20/2 doesn't apply, and the real skater/goalie
// capacities have never been established (needs Cas). The numbers below
// are a placeholder only, clearly flagged as such in both this comment and
// the seed's own console output — do not treat them as authoritative.
const CAPACITY_BY_SESSION_TYPE: Record<
  "scrimmage" | "skills_training",
  {
    skater: { capacity: number; ideal: number; seasonPriceCents: number };
    goalie: { capacity: number; ideal: number; seasonPriceCents: number };
  }
> = {
  scrimmage: {
    skater: { capacity: 20, ideal: 16, seasonPriceCents: 30000 },
    goalie: { capacity: 2, ideal: 2, seasonPriceCents: 15000 },
  },
  // PLACEHOLDER — see D12 above. Not a real, confirmed capacity.
  skills_training: {
    skater: { capacity: 10, ideal: 8, seasonPriceCents: 45000 },
    goalie: { capacity: 2, ideal: 2, seasonPriceCents: 45000 },
  },
};
const EXTRAS_PRICE_CENTS = { skater: 1500, goalie: 0 };

type Db = ReturnType<typeof createDb>;

async function seedLevels(db: Db) {
  await db.insert(levels).values(REAL_LEVELS).onConflictDoNothing({ target: levels.name });
  return db.select().from(levels).orderBy(levels.rank);
}

async function seedSeason(db: Db) {
  await db.insert(seasons).values(SEASON_2026).onConflictDoNothing({ target: seasons.name });
  const [season] = await db.select().from(seasons).where(eq(seasons.name, SEASON_2026.name));
  if (!season) throw new Error("season seed failed to insert or find its row");
  return season;
}

async function seedSlots(db: Db, seasonId: string) {
  for (const [index, def] of SLOT_DEFS.entries()) {
    await db
      .insert(slots)
      .values({
        seasonId,
        weekday: def.weekday,
        startTime: def.startTime,
        endTime: def.endTime,
        label: def.label,
        sessionType: def.sessionType,
        sortOrder: index + 1,
      })
      .onConflictDoNothing({ target: [slots.seasonId, slots.weekday, slots.startTime] });
  }
  return db.select().from(slots).where(eq(slots.seasonId, seasonId)).orderBy(slots.sortOrder);
}

async function seedSlotCapacitiesAndLevels(
  db: Db,
  slotRows: Array<{ id: string; sessionType: string }>,
  levelIdByName: Map<string, string>,
) {
  for (const [index, slotRow] of slotRows.entries()) {
    const def = SLOT_DEFS[index];
    if (!def) throw new Error(`no slot definition at index ${index}`);
    const byPosition = CAPACITY_BY_SESSION_TYPE[def.sessionType];

    for (const position of ["skater", "goalie"] as const) {
      const { capacity, ideal, seasonPriceCents } = byPosition[position];
      await db
        .insert(slotCapacities)
        .values({
          slotId: slotRow.id,
          position,
          capacity,
          idealCapacity: ideal,
          seasonPriceCents,
          extrasPriceCents: EXTRAS_PRICE_CENTS[position],
        })
        .onConflictDoNothing({ target: [slotCapacities.slotId, slotCapacities.position] });
    }

    for (const levelName of def.levelNames) {
      const levelId = levelIdByName.get(levelName);
      if (!levelId) throw new Error(`unknown level name in SLOT_DEFS: ${levelName}`);
      await db
        .insert(slotLevels)
        .values({ slotId: slotRow.id, levelId })
        .onConflictDoNothing({ target: [slotLevels.slotId, slotLevels.levelId] });
    }
  }
}

async function main(): Promise<void> {
  const db = createDb();

  const levelRows = await seedLevels(db);
  console.log("[seed] levels, ordered by rank:");
  for (const row of levelRows) {
    console.log(`  ${row.rank}. ${row.name} (id=${row.id})`);
  }

  const season = await seedSeason(db);
  console.log(`\n[seed] season: ${season.name} (${season.startDate} - ${season.endDate}, ${season.status})`);

  const slotRows = await seedSlots(db, season.id);
  const levelIdByName = new Map(levelRows.map((row) => [row.name, row.id]));
  await seedSlotCapacitiesAndLevels(db, slotRows, levelIdByName);

  console.log(`\n[seed] slots (${slotRows.length}), ordered by sort_order:`);
  const WEEKDAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const [index, slotRow] of slotRows.entries()) {
    const def = SLOT_DEFS[index];
    const caps = await db
      .select()
      .from(slotCapacities)
      .where(eq(slotCapacities.slotId, slotRow.id));
    const provisional = def?.sessionType === "skills_training" ? " [capacity PROVISIONAL — DOMAIN-MODEL §14 D12]" : "";
    const capSummary = caps
      .map((c) => `${c.position} ${c.capacity}/ideal ${c.idealCapacity} @ €${c.seasonPriceCents / 100} season / €${c.extrasPriceCents / 100} extras`)
      .join(", ");
    console.log(
      `  ${WEEKDAY_NAMES[slotRow.weekday]} ${slotRow.startTime}-${slotRow.endTime} "${slotRow.label}" (${def?.sessionType}) — ${capSummary}${provisional}`,
    );
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
