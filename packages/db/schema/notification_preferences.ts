// Per docs/DOMAIN-MODEL.md §11.
//
// "confirmation_request cannot be fully disabled" (at least one channel
// must stay active for that category, since non-response releases a spot —
// see §5) is a cross-row business rule: it depends on every OTHER row for
// the same person and category, which a single-row CHECK constraint can't
// express. Deliberately left to application logic — schema only, no
// domain logic this session.
import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    channel: text("channel").notNull(),
    category: text("category").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    // Filter — nullable = all slots. No FK on array elements, same
    // reasoning as extras_interest.slot_ids.
    slotIds: uuid("slot_ids").array(),
    createdAt: createdAt(),
  },
  (t) => [
    check("notification_preferences_channel_check", sql`${t.channel} in ('email', 'push')`),
    check(
      "notification_preferences_category_check",
      sql`${t.category} in ('spot_open', 'confirmation_request', 'session_change', 'poll', 'announcement', 'payment')`,
    ),
    unique("notification_preferences_person_channel_category_unique").on(
      t.personId,
      t.channel,
      t.category,
    ),
  ],
);
