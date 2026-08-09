// Seeds reference data and a realistic 2026 season, per
// docs/DOMAIN-MODEL.md §1 (ground truth) and §2 (levels). Idempotent — safe
// to re-run, via ON CONFLICT DO NOTHING keyed on each table's unique
// constraint.
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

const REAL_LEVELS: Array<{ name: string; rank: number }> = [
  { name: "2nd/3rd", rank: 1 },
  { name: "3rd/4th", rank: 2 },
  { name: "5th/6th", rank: 3 },
  { name: "Recreational", rank: 4 },
  { name: "Skills", rank: 5 },
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

// Synthetic dev schedule — DOMAIN-MODEL §1 gives only the total slot count
// (10) and per-position capacity/price, not an actual weekday/time grid.
// One rink, evenings Mon-Fri, a Sunday morning skills slot. Ordered
// weekday-then-time, matching how the public schedule reads.
const SLOT_DEFS: Array<{
  weekday: number; // ISO: 1 = Monday .. 7 = Sunday
  startTime: string;
  endTime: string;
  label: string;
  sessionType: "scrimmage" | "skills_training";
  levelNames: string[];
}> = [
  { weekday: 1, startTime: "20:30", endTime: "21:30", label: "2nd/3rd", sessionType: "scrimmage", levelNames: ["2nd/3rd"] },
  { weekday: 1, startTime: "21:30", endTime: "22:30", label: "3rd/4th", sessionType: "scrimmage", levelNames: ["3rd/4th"] },
  { weekday: 2, startTime: "20:30", endTime: "21:30", label: "Recreational", sessionType: "scrimmage", levelNames: ["Recreational"] },
  { weekday: 2, startTime: "21:30", endTime: "22:30", label: "Recreational", sessionType: "scrimmage", levelNames: ["Recreational"] },
  { weekday: 3, startTime: "20:30", endTime: "21:30", label: "5th/6th", sessionType: "scrimmage", levelNames: ["5th/6th"] },
  { weekday: 3, startTime: "21:30", endTime: "22:30", label: "5th/6th", sessionType: "scrimmage", levelNames: ["5th/6th"] },
  { weekday: 4, startTime: "20:30", endTime: "21:30", label: "2nd/3rd", sessionType: "scrimmage", levelNames: ["2nd/3rd"] },
  { weekday: 4, startTime: "21:30", endTime: "22:30", label: "3rd/4th", sessionType: "scrimmage", levelNames: ["3rd/4th"] },
  { weekday: 5, startTime: "21:00", endTime: "22:00", label: "Recreational", sessionType: "scrimmage", levelNames: ["Recreational"] },
  { weekday: 7, startTime: "09:00", endTime: "10:30", label: "Skills Training", sessionType: "skills_training", levelNames: ["Skills"] },
];

// Ground truth, DOMAIN-MODEL §1. Extras prices apply regardless of slot
// type — the ground truth table only differentiates season price by
// scrimmage vs skills training, not extras price.
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
  // Split ice — DOMAIN-MODEL §1 gives only the season prices for skills
  // training, not headcounts. Invented, smaller than full-ice regular
  // capacity, clearly synthetic.
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
    const capSummary = caps
      .map((c) => `${c.position} ${c.capacity}/ideal ${c.idealCapacity} @ €${c.seasonPriceCents / 100} season / €${c.extrasPriceCents / 100} extras`)
      .join(", ");
    console.log(
      `  ${WEEKDAY_NAMES[slotRow.weekday]} ${slotRow.startTime}-${slotRow.endTime} "${slotRow.label}" (${def?.sessionType}) — ${capSummary}`,
    );
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
