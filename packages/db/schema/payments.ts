// Per docs/DOMAIN-MODEL.md §8. The webhook is the only authority on
// payment — docs/ARCHITECTURE.md §4.5. mollie_payment_id is the webhook
// idempotency key, since Mollie retries.
//
// What a payment is for is exactly one of three cases, enforced by
// payments_cart_or_claim_exclusive below: cart_id set (a registration cart,
// or an accepted waitlist offer), claim_id set (an extras claim), or both
// null (settling an outstanding balance — a payment-plan instalment or
// dispensation catch-up). Never both set.
//
// These are real foreign keys, not a polymorphic pair, precisely so the
// webhook can determine what it's confirming from the database alone.
// Mollie's payment metadata is a cross-check only — it must never be
// load-bearing for reconciliation.
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns.ts";
import { claims } from "./claims.ts";
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
    // Nullable — a registration cart, or an accepted waitlist offer. At
    // most one of cart_id/claim_id may be set; see the CHECK below.
    cartId: uuid("cart_id").references(() => registrationCarts.id, { onDelete: "restrict" }),
    // Nullable — an extras claim. At most one of cart_id/claim_id may be
    // set; see the CHECK below.
    claimId: uuid("claim_id").references(() => claims.id, { onDelete: "restrict" }),
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
    // At most one of cart_id/claim_id — never both. The third valid state
    // (settling an outstanding balance) is both null.
    check(
      "payments_cart_or_claim_exclusive",
      sql`not (${t.cartId} is not null and ${t.claimId} is not null)`,
    ),
  ],
);
