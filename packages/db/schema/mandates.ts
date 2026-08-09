// Per docs/DOMAIN-MODEL.md §8. Phase two — a stored SEPA Direct Debit
// mandate lets later charges (waitlist promotions, extras claims) happen
// off-session with no redirect. The model is pay-up-front with a checkout;
// the mandate is an optimisation on top, so this table exists now but may
// stay empty until Phase two ships.
import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { people } from "./people.ts";

export const mandates = pgTable(
  "mandates",
  {
    id: id(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    // Idempotency key, same reasoning as payments.mollie_payment_id.
    mollieMandateId: text("mollie_mandate_id").notNull(),
    // Mollie's own mandate status vocabulary (external system's enum, not
    // ours).
    status: text("status").notNull(),
    // Free text, no CHECK: not hardcoded to 'directdebit' even though
    // that's the only type the domain model currently describes, to avoid
    // over-constraining an external vocabulary — same reasoning as
    // payments.method.
    method: text("method").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("mandates_status_check", sql`${t.status} in ('pending', 'valid', 'invalid')`),
    unique("mandates_mollie_mandate_id_unique").on(t.mollieMandateId),
  ],
);
