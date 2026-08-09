// Per docs/DOMAIN-MODEL.md §11.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    // Not enumerated in the domain model — inferred from
    // docs/ARCHITECTURE.md's "Native: Expo / React Native" and
    // DOMAIN-MODEL §11's "Channels: Email and native push" (no web-push in
    // scope).
    platform: text("platform").notNull(),
    // A device token is a natural external identity, same reasoning as
    // sessions.token_hash.
    token: text("token").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("push_tokens_platform_check", sql`${t.platform} in ('ios', 'android')`),
    unique("push_tokens_token_unique").on(t.token),
  ],
);
