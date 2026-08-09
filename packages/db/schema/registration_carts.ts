// Per docs/DOMAIN-MODEL.md §4. A grouping for payment, not a separate
// lifecycle — registrations carry their own status; the cart is what one
// checkout pays for.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";
import { seasons } from "./seasons.ts";

export const registrationCarts = pgTable(
  "registration_carts",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "registration_carts_status_check",
      sql`${t.status} in ('open', 'awaiting_payment', 'paid', 'expired')`,
    ),
    check("registration_carts_total_non_negative", sql`${t.totalCents} >= 0`),
  ],
);
