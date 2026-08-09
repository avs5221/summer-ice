// Per docs/DOMAIN-MODEL.md §3. The concrete dated instance, generated from
// slot x season weeks.
//
// A reschedule is never an edited date: a cancelled session keeps
// status = cancelled, and a replacement is a NEW row whose superseded_by_id
// points back from the old one.
import { sql } from "drizzle-orm";
import {
  check,
  date,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { slots } from "./slots.ts";

export const iceSessions = pgTable(
  "ice_sessions",
  {
    id: id(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    // Self-reference: the replacement session when this one is superseded.
    // Lazy closure, same pattern as people.guardianId.
    supersededById: uuid("superseded_by_id").references(
      (): AnyPgColumn => iceSessions.id,
      { onDelete: "restrict" },
    ),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("ice_sessions_end_after_start", sql`${t.endAt} > ${t.startAt}`),
    check(
      "ice_sessions_status_check",
      sql`${t.status} in ('scheduled', 'cancelled', 'superseded', 'completed')`,
    ),
    // One row per (slot, date) under the documented reschedule workflow — a
    // replacement session gets a new date; the old row stays 'superseded'.
    unique("ice_sessions_slot_date_unique").on(t.slotId, t.date),
  ],
);
