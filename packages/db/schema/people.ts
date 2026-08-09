// Per docs/DOMAIN-MODEL.md §2. Every human in the system, one row whether
// or not they can log in.
//
// Deliberately NO date_of_birth and NO birth_year — the model stores no age
// data beyond is_adult_attested_at, the signup attestation timestamp. Do
// not add one; see the domain model's own note on why.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { levels } from "./levels.ts";

export const people = pgTable(
  "people",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    // Timestamp of the "I am 16 or over" confirmation at self-signup. Null
    // for dependents, who are added by a guardian.
    isAdultAttestedAt: timestamp("is_adult_attested_at", { withTimezone: true }),
    defaultPosition: text("default_position").notNull(),
    // Self-reported by the player. Nothing gates on it — see DOMAIN-MODEL §4.
    levelId: uuid("level_id").references(() => levels.id, { onDelete: "restrict" }),
    // Set when an admin has looked at and accepted the declared level; null
    // means as-declared.
    levelReviewedAt: timestamp("level_reviewed_at", { withTimezone: true }),
    // Self-reference: set for dependents. Lazy closure so `people` can refer
    // to itself before its own const binding finishes initialising — the
    // standard drizzle self-reference pattern.
    guardianId: uuid("guardian_id").references((): AnyPgColumn => people.id, {
      onDelete: "restrict",
    }),
    status: text("status").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "people_default_position_check",
      sql`${t.defaultPosition} in ('skater', 'goalie', 'both')`,
    ),
    check("people_status_check", sql`${t.status} in ('active', 'inactive')`),
  ],
);
