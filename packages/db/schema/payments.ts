// Per docs/DOMAIN-MODEL.md §8. The webhook is the only authority on
// payment — docs/ARCHITECTURE.md §4.5. mollie_payment_id is the webhook
// idempotency key, since Mollie retries.
//
// NOTE: DOMAIN-MODEL §8 gives this table no claim_id/registration_id
// column — only cart_id. For a paid extras claim, the webhook-to-claim
// correlation therefore isn't a DB foreign key here; it's presumably
// carried in Mollie's own payment metadata at the application layer, with
// ledger_entries.reference_type/reference_id recording the claim
// afterward. Not adding a column the domain model doesn't specify.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { mandates } from "./mandates.ts";
import { people } from "./people.ts";
import { registrationCarts } from "./registration_carts.ts";

export const payments = pgTable(
  "payments",
  {
    id: id(),
    molliePaymentId: text("mollie_payment_id").notNull(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    // Mollie's own payment status vocabulary (external system's enum, not
    // ours) — see https://docs.mollie.com/docs/status-changes.
    status: text("status").notNull(),
    // Free text: Mollie supports many methods (ideal, creditcard, ...) and
    // the domain model doesn't enumerate them, so no CHECK here. Nullable —
    // not always known until the payment starts or completes.
    method: text("method"),
    // Nullable — mandates are explicitly Phase two; most v1 payments won't
    // reference one.
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "restrict" }),
    // Nullable, per the domain model's own text.
    cartId: uuid("cart_id").references(() => registrationCarts.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    webhookReceivedAt: timestamp("webhook_received_at", { withTimezone: true }),
  },
  (t) => [
    check("payments_amount_non_negative", sql`${t.amountCents} >= 0`),
    check(
      "payments_status_check",
      sql`${t.status} in ('open', 'canceled', 'pending', 'authorized', 'expired', 'failed', 'paid')`,
    ),
    unique("payments_mollie_payment_id_unique").on(t.molliePaymentId),
  ],
);
