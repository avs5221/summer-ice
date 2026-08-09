// Per docs/DOMAIN-MODEL.md §10. Created against a cancelled ice_session
// when the rink offers replacement times.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { iceSessions } from "./ice_sessions.ts";

export const polls = pgTable(
  "polls",
  {
    id: id(),
    // The cancelled session.
    iceSessionId: uuid("ice_session_id")
      .notNull()
      .references(() => iceSessions.id, { onDelete: "restrict" }),
    question: text("question").notNull(),
    status: text("status").notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("polls_status_check", sql`${t.status} in ('open', 'closed')`)],
);
