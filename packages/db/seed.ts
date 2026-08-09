// Seeds organisation-wide reference data that isn't season-scoped, per
// docs/DOMAIN-MODEL.md §2. Idempotent — safe to re-run.
//
// The `levels` table has no unique constraint on `name` (the domain model
// specifies only id/name/rank for this table, nothing else), so idempotency
// is done with a pre-check here rather than ON CONFLICT.
//
//   pnpm db:seed
import { createDb } from "./client.ts";
import { levels } from "./schema/index.ts";

const REAL_LEVELS: Array<{ name: string; rank: number }> = [
  { name: "2nd/3rd", rank: 1 },
  { name: "3rd/4th", rank: 2 },
  { name: "5th/6th", rank: 3 },
  { name: "Recreational", rank: 4 },
  { name: "Skills", rank: 5 },
];

async function main(): Promise<void> {
  const db = createDb();

  const existing = await db.select({ name: levels.name }).from(levels);
  const existingNames = new Set(existing.map((row) => row.name));
  const toInsert = REAL_LEVELS.filter((level) => !existingNames.has(level.name));
  if (toInsert.length > 0) {
    await db.insert(levels).values(toInsert);
  }

  const rows = await db.select().from(levels).orderBy(levels.rank);
  console.log("[seed] levels, ordered by rank:");
  for (const row of rows) {
    console.log(`  ${row.rank}. ${row.name} (id=${row.id})`);
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
