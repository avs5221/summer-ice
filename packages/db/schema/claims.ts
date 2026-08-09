// Per docs/DOMAIN-MODEL.md §6. Week-to-week extras claiming on a specific
// ice_session. One shared column set for both positions, even though
// goalie claims are free and skip 'held' entirely, going straight to
// 'confirmed' — see "Zero-price claims" in §6. hold_expires_at simply stays
// null for those rows; there is no separate table and no CHECK coupling
// its nullability to position, since that would be a domain rule about
// which claims require a hold, not a data-integrity fact.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, positionCheck } from "./_columns.ts";
import { iceSessions } from "./ice_sessions.ts";
import { people } from "./people.ts";

export const claims = pgTable(
  "claims",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    iceSessionId: uuid("ice_session_id")
      .notNull()
      .references(() => iceSessions.id, { onDelete: "restrict" }),
    position: text("position").notNull(),
    status: text("status").notNull(),
    // Zero for free goalie claims — the same column serves both positions.
    priceCents: integer("price_cents").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    positionCheck("claims_position_check", t.position),
    check(
      "claims_status_check",
      sql`${t.status} in ('held', 'confirmed', 'withdrawn_in_time', 'withdrawn_late', 'completed')`,
    ),
    check("claims_price_non_negative", sql`${t.priceCents} >= 0`),
  ],
);
