// Per docs/DOMAIN-MODEL.md §3. Who is coaching a given session, in what
// capacity, at what rate. rate_cents is captured at assignment, never
// recalculated — zero for unpaid. Assignment is admin-only; a coach cannot
// add themselves (enforced at the application layer, not here).
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { iceSessions } from "./ice_sessions.ts";
import { people } from "./people.ts";

export const sessionCoaches = pgTable(
  "session_coaches",
  {
    id: id(),
    // Carries rate_cents, so this falls under "never cascade on money" even
    // though it isn't literally named alongside ledger_entries/payments.
    iceSessionId: uuid("ice_session_id")
      .notNull()
      .references(() => iceSessions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    coachRole: text("coach_role").notNull(),
    rateCents: integer("rate_cents").notNull(),
    attendanceStatus: text("attendance_status").notNull().default("unknown"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("session_coaches_coach_role_check", sql`${t.coachRole} in ('trainer', 'shooter')`),
    check("session_coaches_rate_non_negative", sql`${t.rateCents} >= 0`),
    check(
      "session_coaches_attendance_status_check",
      sql`${t.attendanceStatus} in ('unknown', 'confirmed', 'declined')`,
    ),
    // 3-column, not 2: a person may plausibly hold two different coach_roles
    // (trainer + shooter) on the same session, each a distinct assignment
    // with its own rate_cents. This stops duplicate assignments, not
    // legitimate dual roles.
    unique("session_coaches_session_person_role_unique").on(
      t.iceSessionId,
      t.personId,
      t.coachRole,
    ),
  ],
);
