// Per docs/DOMAIN-MODEL.md §3.
import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";

export const seasons = pgTable(
  "seasons",
  {
    id: id(),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    weekCount: integer("week_count").notNull(),
    registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("seasons_name_unique").on(t.name),
    check("seasons_week_count_positive", sql`${t.weekCount} > 0`),
    check(
      "seasons_status_check",
      sql`${t.status} in ('draft', 'registration_open', 'active', 'closed')`,
    ),
  ],
);
