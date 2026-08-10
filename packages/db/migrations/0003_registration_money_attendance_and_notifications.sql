CREATE TABLE "registration_carts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_carts_status_check" CHECK ("registration_carts"."status" in ('open', 'awaiting_payment', 'paid', 'expired')),
	CONSTRAINT "registration_carts_total_non_negative" CHECK ("registration_carts"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"cart_id" uuid,
	"person_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"position" text NOT NULL,
	"status" text NOT NULL,
	"price_cents" integer NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"waitlist_joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_position_check" CHECK ("registrations"."position" in ('skater', 'goalie')),
	CONSTRAINT "registrations_status_check" CHECK ("registrations"."status" in ('held', 'confirmed', 'expired', 'waitlisted', 'offered', 'withdrawn')),
	CONSTRAINT "registrations_price_non_negative" CHECK ("registrations"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"registration_id" uuid NOT NULL,
	"ice_session_id" uuid NOT NULL,
	"position" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendances_registration_session_unique" UNIQUE("registration_id","ice_session_id"),
	CONSTRAINT "attendances_position_check" CHECK ("attendances"."position" in ('skater', 'goalie')),
	CONSTRAINT "attendances_status_check" CHECK ("attendances"."status" in ('unknown', 'attending', 'not_attending')),
	CONSTRAINT "attendances_source_check" CHECK ("attendances"."source" in ('player', 'admin', 'guardian'))
);
--> statement-breakpoint
CREATE TABLE "extras_interest" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"positions" text[] NOT NULL,
	"slot_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extras_interest_person_season_unique" UNIQUE("person_id","season_id"),
	CONSTRAINT "extras_interest_positions_valid" CHECK ("extras_interest"."positions" <@ ARRAY['skater', 'goalie']::text[] AND array_length("extras_interest"."positions", 1) > 0)
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"ice_session_id" uuid NOT NULL,
	"position" text NOT NULL,
	"status" text NOT NULL,
	"price_cents" integer NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_position_check" CHECK ("claims"."position" in ('skater', 'goalie')),
	CONSTRAINT "claims_status_check" CHECK ("claims"."status" in ('held', 'confirmed', 'withdrawn_in_time', 'withdrawn_late', 'completed')),
	CONSTRAINT "claims_price_non_negative" CHECK ("claims"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"entry_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"reversal_of_id" uuid,
	"note" text,
	"created_by" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_entry_type_check" CHECK ("ledger_entries"."entry_type" in ('charge', 'credit', 'payment', 'refund', 'fee', 'payout', 'adjustment'))
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"mollie_mandate_id" text NOT NULL,
	"status" text NOT NULL,
	"method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mandates_mollie_mandate_id_unique" UNIQUE("mollie_mandate_id"),
	CONSTRAINT "mandates_status_check" CHECK ("mandates"."status" in ('pending', 'valid', 'invalid'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"mollie_payment_id" text NOT NULL,
	"person_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text NOT NULL,
	"method" text,
	"mandate_id" uuid,
	"cart_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"webhook_received_at" timestamp with time zone,
	CONSTRAINT "payments_mollie_payment_id_unique" UNIQUE("mollie_payment_id"),
	CONSTRAINT "payments_amount_non_negative" CHECK ("payments"."amount_cents" >= 0),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('open', 'canceled', 'pending', 'authorized', 'expired', 'failed', 'paid'))
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ice_session_id" uuid NOT NULL,
	"question" text NOT NULL,
	"status" text NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "polls_status_check" CHECK ("polls"."status" in ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"poll_id" uuid NOT NULL,
	"proposed_start_at" timestamp with time zone NOT NULL,
	"proposed_end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_options_end_after_start" CHECK ("poll_options"."proposed_end_at" > "poll_options"."proposed_start_at")
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"poll_id" uuid NOT NULL,
	"poll_option_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_poll_person_unique" UNIQUE("poll_id","person_id"),
	CONSTRAINT "poll_votes_response_check" CHECK ("poll_votes"."response" in ('yes', 'no', 'maybe'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"slot_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_person_channel_category_unique" UNIQUE("person_id","channel","category"),
	CONSTRAINT "notification_preferences_channel_check" CHECK ("notification_preferences"."channel" in ('email', 'push')),
	CONSTRAINT "notification_preferences_category_check" CHECK ("notification_preferences"."category" in ('spot_open', 'confirmation_request', 'session_change', 'poll', 'announcement', 'payment'))
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"category" text NOT NULL,
	"channel" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_channel_check" CHECK ("notification_log"."channel" in ('email', 'push')),
	CONSTRAINT "notification_log_category_check" CHECK ("notification_log"."category" in ('spot_open', 'confirmation_request', 'session_change', 'poll', 'announcement', 'payment'))
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"token" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "push_tokens_platform_check" CHECK ("push_tokens"."platform" in ('ios', 'android'))
);
--> statement-breakpoint
ALTER TABLE "registration_carts" ADD CONSTRAINT "registration_carts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_carts" ADD CONSTRAINT "registration_carts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_cart_id_registration_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."registration_carts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_ice_session_id_ice_sessions_id_fk" FOREIGN KEY ("ice_session_id") REFERENCES "public"."ice_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extras_interest" ADD CONSTRAINT "extras_interest_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extras_interest" ADD CONSTRAINT "extras_interest_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_ice_session_id_ice_sessions_id_fk" FOREIGN KEY ("ice_session_id") REFERENCES "public"."ice_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reversal_of_id_ledger_entries_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."ledger_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cart_id_registration_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."registration_carts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_ice_session_id_ice_sessions_id_fk" FOREIGN KEY ("ice_session_id") REFERENCES "public"."ice_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_option_id_poll_options_id_fk" FOREIGN KEY ("poll_option_id") REFERENCES "public"."poll_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_person_slot_position_active_unique" ON "registrations" USING btree ("person_id","slot_id","position") WHERE "registrations"."status" in ('held', 'offered', 'confirmed');