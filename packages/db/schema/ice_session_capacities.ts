// Per docs/DOMAIN-MODEL.md §3. Per-occurrence capacity, defaulted from
// slot_capacities but overridable — the rink sometimes gives a different
// sheet. Deliberately minimal: no ideal_capacity, no price columns — this
// table only overrides `capacity` per occurrence.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, positionCheck } from "./_columns.ts";
import { iceSessions } from "./ice_sessions.ts";

export const iceSessionCapacities = pgTable(
  "ice_session_capacities",
  {
    id: id(),
    iceSessionId: uuid("ice_session_id")
      .notNull()
      .references(() => iceSessions.id, { onDelete: "restrict" }),
    position: text("position").notNull(),
    capacity: integer("capacity").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    positionCheck("ice_session_capacities_position_check", t.position),
    check("ice_session_capacities_capacity_non_negative", sql`${t.capacity} >= 0`),
    unique("ice_session_capacities_session_position_unique").on(
      t.iceSessionId,
      t.position,
    ),
  ],
);
