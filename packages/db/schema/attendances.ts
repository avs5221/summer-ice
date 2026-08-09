// Per docs/DOMAIN-MODEL.md §5. Generated for each confirmed registration x
// each future ice_session. Three-state, must-confirm: unknown resolves to
// not_attending at release_at unless the player responds first.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, positionCheck } from "./_columns.ts";
import { iceSessions } from "./ice_sessions.ts";
import { registrations } from "./registrations.ts";

export const attendances = pgTable(
  "attendances",
  {
    id: id(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "restrict" }),
    iceSessionId: uuid("ice_session_id")
      .notNull()
      .references(() => iceSessions.id, { onDelete: "restrict" }),
    position: text("position").notNull(),
    status: text("status").notNull().default("unknown"),
    // The moment 'unknown' resolves to out. Defaulted from the season,
    // overridable per session — always supplied by application code, since
    // that computation spans two other tables and Postgres column defaults
    // can't reach across tables.
    releaseAt: timestamp("release_at", { withTimezone: true }).notNull(),
    // Set when an unanswered row was resolved out, so late reinstatement
    // and admin review can tell that apart from an explicit decline.
    releasedAt: timestamp("released_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    source: text("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    positionCheck("attendances_position_check", t.position),
    check(
      "attendances_status_check",
      sql`${t.status} in ('unknown', 'attending', 'not_attending')`,
    ),
    check("attendances_source_check", sql`${t.source} in ('player', 'admin', 'guardian')`),
    unique("attendances_registration_session_unique").on(t.registrationId, t.iceSessionId),
  ],
);
