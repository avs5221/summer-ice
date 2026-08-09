// Per docs/DOMAIN-MODEL.md §2.
import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const roles = pgTable(
  "roles",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("roles_role_check", sql`${t.role} in ('admin', 'scheduler', 'coach', 'player')`),
    unique("roles_person_id_role_unique").on(t.personId, t.role),
  ],
);
