// Per docs/DOMAIN-MODEL.md §2: organisation-wide, not season-scoped, ordered
// by rank so levels can be compared. Nothing else belongs on this table.
//
// id was originally an integer identity column (scaffolding session); this
// migrates it to uuid + uuidv7(), per docs/ARCHITECTURE.md §5, while nothing
// yet references it. See migrations/ for the hand-adjusted rekey — an
// ordinary ALTER COLUMN ... TYPE uuid has no valid integer->uuid cast.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";

export const levels = pgTable(
  "levels",
  {
    id: id(),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("levels_name_unique").on(t.name),
    unique("levels_rank_unique").on(t.rank),
    check("levels_rank_positive", sql`${t.rank} > 0`),
  ],
);
