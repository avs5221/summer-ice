// Per docs/DOMAIN-MODEL.md §6. The public "keep me informed" list — open to
// anyone, including people who have never skated in Leiden.
import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";
import { seasons } from "./seasons.ts";

export const extrasInterest = pgTable(
  "extras_interest",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    // Which positions they'd claim.
    positions: text("positions").array().notNull(),
    // Which hours they want to hear about — nullable = all. No FK on array
    // elements: Postgres can't constrain individual array entries against
    // another table without a trigger, which is domain logic, out of scope
    // for a schema-only session.
    slotIds: uuid("slot_ids").array(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "extras_interest_positions_valid",
      sql`${t.positions} <@ ARRAY['skater', 'goalie']::text[] AND array_length(${t.positions}, 1) > 0`,
    ),
    // One interest-list row per person per season.
    unique("extras_interest_person_season_unique").on(t.personId, t.seasonId),
  ],
);
