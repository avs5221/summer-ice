// Shared column/constraint builders, per docs/ARCHITECTURE.md §5 "Schema
// conventions". Internal plumbing only — not re-exported from
// schema/index.ts, since nothing outside the schema files needs these
// builders directly.
import { sql } from "drizzle-orm";
import { check, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

/** `id uuid primary key default uuidv7()` — every table gets one. */
export function id() {
  return uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`);
}

/** `created_at timestamptz not null default now()` — every table gets one. */
export function createdAt() {
  return timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
}

/**
 * The `'skater' | 'goalie'` position check shared by slot_capacities and
 * ice_session_capacities. Distinct from people.default_position, which is a
 * separate 3-value ('skater' | 'goalie' | 'both') check defined inline.
 */
export function positionCheck(name: string, column: AnyPgColumn) {
  return check(name, sql`${column} in ('skater', 'goalie')`);
}
