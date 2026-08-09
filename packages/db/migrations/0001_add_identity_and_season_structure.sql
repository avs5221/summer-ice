CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"is_adult_attested_at" timestamp with time zone,
	"default_position" text NOT NULL,
	"level_id" uuid,
	"level_reviewed_at" timestamp with time zone,
	"guardian_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_default_position_check" CHECK ("people"."default_position" in ('skater', 'goalie', 'both')),
	CONSTRAINT "people_status_check" CHECK ("people"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credentials_provider_subject_unique" UNIQUE("provider","provider_subject"),
	CONSTRAINT "credentials_provider_check" CHECK ("credentials"."provider" in ('password', 'google', 'apple', 'email_link'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"client" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_client_check" CHECK ("sessions"."client" in ('web', 'native'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_person_id_role_unique" UNIQUE("person_id","role"),
	CONSTRAINT "roles_role_check" CHECK ("roles"."role" in ('admin', 'scheduler', 'coach', 'player'))
);
--> statement-breakpoint
CREATE TABLE "player_flags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"person_id" uuid NOT NULL,
	"flag_type" text NOT NULL,
	"source" text NOT NULL,
	"created_by" uuid,
	"reference_type" text,
	"reference_id" uuid,
	"note" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "player_flags_flag_type_check" CHECK ("player_flags"."flag_type" in ('level_mismatch', 'no_history', 'admin_note')),
	CONSTRAINT "player_flags_source_check" CHECK ("player_flags"."source" in ('admin', 'system')),
	CONSTRAINT "player_flags_status_check" CHECK ("player_flags"."status" in ('open', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"week_count" integer NOT NULL,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_name_unique" UNIQUE("name"),
	CONSTRAINT "seasons_week_count_positive" CHECK ("seasons"."week_count" > 0),
	CONSTRAINT "seasons_status_check" CHECK ("seasons"."status" in ('draft', 'registration_open', 'active', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"season_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"label" text NOT NULL,
	"session_type" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slots_season_weekday_start_unique" UNIQUE("season_id","weekday","start_time"),
	CONSTRAINT "slots_weekday_range" CHECK ("slots"."weekday" between 1 and 7),
	CONSTRAINT "slots_end_after_start" CHECK ("slots"."end_time" > "slots"."start_time"),
	CONSTRAINT "slots_session_type_check" CHECK ("slots"."session_type" in ('scrimmage', 'skills_training'))
);
--> statement-breakpoint
CREATE TABLE "slot_levels" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slot_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_levels_slot_level_unique" UNIQUE("slot_id","level_id")
);
--> statement-breakpoint
CREATE TABLE "slot_capacities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slot_id" uuid NOT NULL,
	"position" text NOT NULL,
	"capacity" integer NOT NULL,
	"ideal_capacity" integer NOT NULL,
	"season_price_cents" integer NOT NULL,
	"extras_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_capacities_slot_position_unique" UNIQUE("slot_id","position"),
	CONSTRAINT "slot_capacities_position_check" CHECK ("slot_capacities"."position" in ('skater', 'goalie')),
	CONSTRAINT "slot_capacities_capacity_non_negative" CHECK ("slot_capacities"."capacity" >= 0),
	CONSTRAINT "slot_capacities_ideal_capacity_non_negative" CHECK ("slot_capacities"."ideal_capacity" >= 0),
	CONSTRAINT "slot_capacities_ideal_le_capacity" CHECK ("slot_capacities"."ideal_capacity" <= "slot_capacities"."capacity"),
	CONSTRAINT "slot_capacities_season_price_non_negative" CHECK ("slot_capacities"."season_price_cents" >= 0),
	CONSTRAINT "slot_capacities_extras_price_non_negative" CHECK ("slot_capacities"."extras_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slot_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"superseded_by_id" uuid,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ice_sessions_slot_date_unique" UNIQUE("slot_id","date"),
	CONSTRAINT "ice_sessions_end_after_start" CHECK ("ice_sessions"."end_at" > "ice_sessions"."start_at"),
	CONSTRAINT "ice_sessions_status_check" CHECK ("ice_sessions"."status" in ('scheduled', 'cancelled', 'superseded', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "ice_session_capacities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ice_session_id" uuid NOT NULL,
	"position" text NOT NULL,
	"capacity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ice_session_capacities_session_position_unique" UNIQUE("ice_session_id","position"),
	CONSTRAINT "ice_session_capacities_position_check" CHECK ("ice_session_capacities"."position" in ('skater', 'goalie')),
	CONSTRAINT "ice_session_capacities_capacity_non_negative" CHECK ("ice_session_capacities"."capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session_coaches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ice_session_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"coach_role" text NOT NULL,
	"rate_cents" integer NOT NULL,
	"attendance_status" text DEFAULT 'unknown' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_coaches_session_person_role_unique" UNIQUE("ice_session_id","person_id","coach_role"),
	CONSTRAINT "session_coaches_coach_role_check" CHECK ("session_coaches"."coach_role" in ('trainer', 'shooter')),
	CONSTRAINT "session_coaches_rate_non_negative" CHECK ("session_coaches"."rate_cents" >= 0),
	CONSTRAINT "session_coaches_attendance_status_check" CHECK ("session_coaches"."attendance_status" in ('unknown', 'confirmed', 'declined'))
);
--> statement-breakpoint
-- Hand-adjusted: drizzle-kit's naive "SET DATA TYPE uuid" has no valid
-- integer->uuid cast and fails against the 5 rows already seeded in dev.
-- DROP IDENTITY first (identity columns carry no plain default expression,
-- so DROP DEFAULT would error here; this also drops the owned
-- levels_id_seq sequence automatically). USING uuidv7() re-keys existing
-- rows with fresh v7 UUIDs, ignoring the old integer value -- fine, since
-- nothing references levels.id yet.
ALTER TABLE "levels" ALTER COLUMN "id" DROP IDENTITY IF EXISTS;--> statement-breakpoint
ALTER TABLE "levels" ALTER COLUMN "id" TYPE uuid USING uuidv7();--> statement-breakpoint
ALTER TABLE "levels" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "levels" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_guardian_id_people_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_flags" ADD CONSTRAINT "player_flags_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_flags" ADD CONSTRAINT "player_flags_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_levels" ADD CONSTRAINT "slot_levels_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_levels" ADD CONSTRAINT "slot_levels_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_capacities" ADD CONSTRAINT "slot_capacities_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_sessions" ADD CONSTRAINT "ice_sessions_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_sessions" ADD CONSTRAINT "ice_sessions_superseded_by_id_ice_sessions_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."ice_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_session_capacities" ADD CONSTRAINT "ice_session_capacities_ice_session_id_ice_sessions_id_fk" FOREIGN KEY ("ice_session_id") REFERENCES "public"."ice_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_coaches" ADD CONSTRAINT "session_coaches_ice_session_id_ice_sessions_id_fk" FOREIGN KEY ("ice_session_id") REFERENCES "public"."ice_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_coaches" ADD CONSTRAINT "session_coaches_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_person_id_idx" ON "sessions" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_rank_unique" UNIQUE("rank");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_rank_positive" CHECK ("levels"."rank" > 0);