// Per docs/DOMAIN-MODEL.md §2. One passive "someone should look at this"
// mechanism covering every such signal about a person. Nothing here blocks
// anything.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const playerFlags = pgTable(
  "player_flags",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    flagType: text("flag_type").notNull(),
    source: text("source").notNull(),
    // Null when system-generated.
    createdBy: uuid("created_by").references(() => people.id, { onDelete: "restrict" }),
    // The registration or claim that prompted this flag, both out of scope
    // this session — deliberately no FK, since reference_id is polymorphic.
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    note: text("note"),
    status: text("status").notNull(),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "player_flags_flag_type_check",
      sql`${t.flagType} in ('level_mismatch', 'no_history', 'admin_note')`,
    ),
    check("player_flags_source_check", sql`${t.source} in ('admin', 'system')`),
    check(
      "player_flags_status_check",
      sql`${t.status} in ('open', 'resolved', 'dismissed')`,
    ),
  ],
);
