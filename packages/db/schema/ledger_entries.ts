// Per docs/DOMAIN-MODEL.md §8 and docs/ARCHITECTURE.md §4.8 — append-only.
// Never UPDATE or DELETE a row here; corrections are new, offsetting
// entries. Balance is SUM(amount_cents) per person. See
// .claude/rules/db.md.
//
// amount_cents is signed by convention: positive is owed to the league,
// negative is owed by it (coach payables share this table). Deliberately
// NO non-negative check here — that would break the sign convention that
// makes one append-only stream work for both receivables and payables.
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    entryType: text("entry_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    // Registration, claim, cancellation, coach assignment, ... —
    // polymorphic, deliberately no FK since it points at several tables.
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    // Self-reference: the entry this one reverses, if any. Lazy closure so
    // ledgerEntries can refer to itself before its own const binding
    // finishes initialising — same pattern as people.guardianId.
    reversalOfId: uuid("reversal_of_id").references(
      (): AnyPgColumn => ledgerEntries.id,
      { onDelete: "restrict" },
    ),
    note: text("note"),
    // Nullable — system-generated entries (e.g. an automated release
    // charge) have no human creator.
    createdBy: uuid("created_by").references(() => people.id, { onDelete: "restrict" }),
    // Distinct from created_at: the event's effective date, which
    // application code may backdate for corrections. created_at is always
    // strictly row-insert time.
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "ledger_entries_entry_type_check",
      sql`${t.entryType} in ('charge', 'credit', 'payment', 'refund', 'fee', 'payout', 'adjustment')`,
    ),
  ],
);
