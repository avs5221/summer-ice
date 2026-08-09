// Per docs/DOMAIN-MODEL.md §11. Needed for dedup and rate limiting. No
// unique constraint: the described dedup rule ("don't tell the same person
// about the same session twice within an hour") is time-windowed, not a
// plain uniqueness invariant, so a UNIQUE constraint is the wrong tool —
// left to application query logic.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const notificationLog = pgTable(
  "notification_log",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    category: text("category").notNull(),
    channel: text("channel").notNull(),
    // Polymorphic — deliberately no FK, same reasoning as
    // player_flags.reference_type/reference_id.
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    check("notification_log_channel_check", sql`${t.channel} in ('email', 'push')`),
    check(
      "notification_log_category_check",
      sql`${t.category} in ('spot_open', 'confirmation_request', 'session_change', 'poll', 'announcement', 'payment')`,
    ),
  ],
);
