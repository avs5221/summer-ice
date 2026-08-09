// Per docs/DOMAIN-MODEL.md §10. Proposed replacement times for a poll.
//
// on delete restrict, NOT cascade: docs/ARCHITECTURE.md §5 names
// poll_options as a cascade-eligible lookup/join table example, but this
// session's task explicitly overrides that — no FK in this batch of tables
// may cascade, full stop, so a deleted person or poll fails loudly rather
// than silently taking financial/vote history with it. Deliberate
// deviation from the architecture doc's own example.
import { sql } from "drizzle-orm";
import { check, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { polls } from "./polls.ts";

export const pollOptions = pgTable(
  "poll_options",
  {
    id: id(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "restrict" }),
    proposedStartAt: timestamp("proposed_start_at", { withTimezone: true }).notNull(),
    proposedEndAt: timestamp("proposed_end_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "poll_options_end_after_start",
      sql`${t.proposedEndAt} > ${t.proposedStartAt}`,
    ),
  ],
);
