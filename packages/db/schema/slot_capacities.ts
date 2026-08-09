// Per docs/DOMAIN-MODEL.md §3 — the key table. Capacity, ideal fill and
// pricing are ROWS keyed on (slot, position), never columns on the slot.
// This is the row every claim and registration locks FOR UPDATE — see
// docs/ARCHITECTURE.md §4.3 and .claude/rules/core.md.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, positionCheck } from "./_columns.ts";
import { slots } from "./slots.ts";

export const slotCapacities = pgTable(
  "slot_capacities",
  {
    id: id(),
    // Carries _cents pricing, so this falls under "never cascade on money"
    // even though it isn't literally named alongside ledger_entries/payments.
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "restrict" }),
    position: text("position").notNull(),
    capacity: integer("capacity").notNull(),
    idealCapacity: integer("ideal_capacity").notNull(),
    seasonPriceCents: integer("season_price_cents").notNull(),
    extrasPriceCents: integer("extras_price_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    positionCheck("slot_capacities_position_check", t.position),
    check("slot_capacities_capacity_non_negative", sql`${t.capacity} >= 0`),
    check(
      "slot_capacities_ideal_capacity_non_negative",
      sql`${t.idealCapacity} >= 0`,
    ),
    check(
      "slot_capacities_ideal_le_capacity",
      sql`${t.idealCapacity} <= ${t.capacity}`,
    ),
    check(
      "slot_capacities_season_price_non_negative",
      sql`${t.seasonPriceCents} >= 0`,
    ),
    check(
      "slot_capacities_extras_price_non_negative",
      sql`${t.extrasPriceCents} >= 0`,
    ),
    unique("slot_capacities_slot_position_unique").on(t.slotId, t.position),
  ],
);
