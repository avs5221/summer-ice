// Auth sessions (not to be confused with `ice_sessions`). NOT the actual
// session mechanism — a self-hosted-plan relic never revisited when auth
// pivoted to Supabase Auth (found and documented 2026-08-10,
// DOMAIN-MODEL.md §2 and ARCHITECTURE.md §7). Supabase Auth's own
// JWT/cookie session (@supabase/ssr) is authoritative; nothing reads or
// writes this table. Kept migrated rather than dropped, but do not wire
// it into anything on the assumption its presence here means it's used.
// Original rationale, for the record: web/native session tokens,
// soft-revoked rather than deleted, with no IP/user-agent/device data
// since nothing in this system identified a use for it (the same
// reasoning behind storing no date of birth — see people.ts).
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    // No financial or historical value here, unlike the restrict-by-default
    // rule's target — deleting a person should take their sessions with it.
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    client: text("client").notNull(),
    // Never the raw token — a leaked database must not yield usable
    // sessions. Unique because it's the lookup key.
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("sessions_client_check", sql`${t.client} in ('web', 'native')`),
    unique("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_person_id_idx").on(t.personId),
  ],
);
