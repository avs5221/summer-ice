// Per docs/DOMAIN-MODEL.md §2: organisation-wide, not season-scoped, ordered
// by rank so levels can be compared. Nothing else belongs on this table —
// the rest of the schema is a later session (see CLAUDE.md task scope).
import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const levels = pgTable("levels", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").notNull(),
  rank: integer("rank").notNull(),
});
