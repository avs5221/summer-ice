-- How long a waitlist offer (registrations.status = 'offered') stays open
-- before packages/core's promoteWaitlist treats it as expired. Per-season
-- and admin-configurable on purpose, not a packages/core constant — the
-- domain model never specified a duration (unlike the fixed 10-minute hold
-- window, ARCHITECTURE §7), and the human call on this was "1 hour for now,
-- but configurable in the admin dashboard." Default applies to the one
-- existing seeded season.
ALTER TABLE "seasons" ADD COLUMN "offer_window_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_offer_window_minutes_positive" CHECK ("seasons"."offer_window_minutes" > 0);