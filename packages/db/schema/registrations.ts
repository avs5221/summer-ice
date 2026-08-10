// Per docs/DOMAIN-MODEL.md §4. One table covers the whole registration
// lifecycle, including waitlisting — see the state machine there.
//
// status is exactly the six values named in the state-machine's own
// definitional list (held, confirmed, expired, waitlisted, offered,
// withdrawn). 'declined' and 'offer_expired' appear only as transition
// arrows in that diagram — both resolve to 'withdrawn' (removing the
// person from the queue entirely — settled 2026-08-10, packages/core's
// declineOffer and promoteWaitlist), not a new status and not a re-queue
// back to 'waitlisted'.
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, positionCheck } from "./_columns.ts";
import { people } from "./people.ts";
import { registrationCarts } from "./registration_carts.ts";
import { slots } from "./slots.ts";

export const registrations = pgTable(
  "registrations",
  {
    id: id(),
    // Nullable — admin-created registrations have none. Per
    // docs/ARCHITECTURE.md §5's own nullable-columns example.
    cartId: uuid("cart_id").references(() => registrationCarts.id, {
      onDelete: "restrict",
    }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "restrict" }),
    position: text("position").notNull(),
    status: text("status").notNull(),
    // Captured at hold time, never recalculated. No FK-derived pricing —
    // no default here; application code always supplies it explicitly.
    priceCents: integer("price_cents").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true }),
    // Ordering key for the waitlist queue.
    waitlistJoinedAt: timestamp("waitlist_joined_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    positionCheck("registrations_position_check", t.position),
    check(
      "registrations_status_check",
      sql`${t.status} in ('held', 'confirmed', 'expired', 'waitlisted', 'offered', 'withdrawn')`,
    ),
    check("registrations_price_non_negative", sql`${t.priceCents} >= 0`),
    // The database prevents duplicates, not the application — per
    // docs/ARCHITECTURE.md §4.4. PARTIAL: only rows still holding a claim
    // on the slot participate. A withdrawn (or expired) row does not, so a
    // player can re-register after withdrawing — a total unique constraint
    // would block that.
    uniqueIndex("registrations_person_slot_position_active_unique")
      .on(t.personId, t.slotId, t.position)
      .where(sql`${t.status} in ('held', 'offered', 'confirmed')`),
  ],
);
