// Per docs/DOMAIN-MODEL.md §2. Login methods, kept separate from `people` so
// a dependent can be promoted to a full account by inserting a row — no data
// migration, no lost history.
import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const credentials = pgTable(
  "credentials",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject"),
    passwordHash: text("password_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "credentials_provider_check",
      sql`${t.provider} in ('password', 'google', 'apple', 'email_link')`,
    ),
    // Two people can't legitimately share the same OAuth identity. A plain
    // (nulls-distinct) unique constraint leaves multiple 'password' rows
    // with a null provider_subject unaffected.
    unique("credentials_provider_subject_unique").on(t.provider, t.providerSubject),
  ],
);
