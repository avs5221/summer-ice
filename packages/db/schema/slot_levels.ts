// Per docs/DOMAIN-MODEL.md §3. Which levels a slot is intended for. Advisory
// only — see DOMAIN-MODEL §4 — it does not gate selection.
//
// Join table: the one case docs/ARCHITECTURE.md §5 explicitly names as
// cascade-eligible.
import { pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { levels } from "./levels.ts";
import { slots } from "./slots.ts";

export const slotLevels = pgTable(
  "slot_levels",
  {
    id: id(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [unique("slot_levels_slot_level_unique").on(t.slotId, t.levelId)],
);
