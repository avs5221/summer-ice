// Per docs/DOMAIN-MODEL.md §3. A recurring weekly hour.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { seasons } from "./seasons.ts";

export const slots = pgTable(
  "slots",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    // ISO weekday: 1 = Monday .. 7 = Sunday.
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    label: text("label").notNull(),
    sessionType: text("session_type").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("slots_weekday_range", sql`${t.weekday} between 1 and 7`),
    check("slots_end_after_start", sql`${t.endTime} > ${t.startTime}`),
    check(
      "slots_session_type_check",
      sql`${t.sessionType} in ('scrimmage', 'skills_training')`,
    ),
    // One rink: one slot per (weekday, start_time) per season. Also makes
    // seeding idempotent.
    unique("slots_season_weekday_start_unique").on(t.seasonId, t.weekday, t.startTime),
  ],
);
