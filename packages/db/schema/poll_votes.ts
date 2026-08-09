// Per docs/DOMAIN-MODEL.md §10. One row per person per POLL (not per
// option) — poll_option_id records which proposed time they picked;
// response records their confidence in that choice. Per
// docs/ARCHITECTURE.md §5's explicit unique(poll_id, person_id).
import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";
import { pollOptions } from "./poll_options.ts";
import { polls } from "./polls.ts";

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: id(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "restrict" }),
    pollOptionId: uuid("poll_option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    response: text("response").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("poll_votes_response_check", sql`${t.response} in ('yes', 'no', 'maybe')`),
    unique("poll_votes_poll_person_unique").on(t.pollId, t.personId),
  ],
);
