-- Live fill broadcast — Supabase Realtime, replacing the old
-- LISTEN/NOTIFY-over-SSE mechanism (see docs/ARCHITECTURE.md and
-- docs/DOMAIN-MODEL.md §9). The BEHAVIOUR this exists to serve is
-- unchanged: an aggregate integer count per (slot, position), with holds
-- and offers counted as taken for display — see DOMAIN-MODEL §9,
-- "holds count as taken, because they are." Only the transport changed.
--
-- Scope, deliberately: this covers SEASON registration fill — the
-- "18/20 skaters" number on the public schedule and register pages,
-- computed from `registrations` against `slot_capacities`. Per-session
-- (dated ice_session) extras/attendance fill is the same pattern against
-- `attendances`/`claims`/`ice_session_capacities`, added when that feature
-- is actually built — no attendance or claims write-path exists yet, so
-- there is nothing there to wire a trigger to today.
--
-- Functions are created unconditionally — safe even here, on whatever
-- database this migration happens to run against, because PL/pgSQL
-- resolves function CALLS inside a body at EXECUTION time, not at CREATE
-- FUNCTION time. A body that calls realtime.send() compiles and creates
-- fine on a plain Postgres with no `realtime` schema at all; it would only
-- fail if actually invoked.
--
-- Triggers are NOT unconditional, for exactly that reason: attaching them
-- on a database without `realtime` would make every ordinary
-- INSERT/UPDATE/DELETE on these tables fail, breaking local writes rather
-- than just leaving Realtime untested. The guard below checks for the
-- `realtime` schema and only attaches the triggers where it exists — on a
-- real Supabase project. Against packages/db/docker-compose.yml (plain
-- Postgres, no Realtime), this migration is a straightforward no-op for
-- the trigger half, and package/db's local dev story is unaffected.
--
-- This means the live-fill broadcast path genuinely cannot be exercised
-- against local Docker — there is no local stand-in for `realtime.send()`.
-- It needs the real Supabase project (not yet created — see
-- docs/ARCHITECTURE.md).

CREATE OR REPLACE FUNCTION broadcast_slot_fill(p_slot_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_skater_capacity integer;
  v_goalie_capacity integer;
  v_skater_taken integer;
  v_goalie_taken integer;
BEGIN
  SELECT
    max(capacity) FILTER (WHERE position = 'skater'),
    max(capacity) FILTER (WHERE position = 'goalie')
  INTO v_skater_capacity, v_goalie_capacity
  FROM slot_capacities
  WHERE slot_id = p_slot_id;

  -- "Taken" is capacity minus the computed-availability formula in
  -- docs/ARCHITECTURE.md §4.2 (capacity − confirmed − active holds − active
  -- offers) — i.e. everything that formula subtracts. A hold or offer that
  -- has lapsed (hold_expires_at / offer_expires_at in the past) does not
  -- count, exactly as availability is never allowed to depend on a sweep
  -- job having run. Waitlisted rows are free and never count as taken —
  -- they're already beyond capacity by definition.
  SELECT
    count(*) FILTER (
      WHERE position = 'skater'
        AND (
          status = 'confirmed'
          OR (status = 'held' AND hold_expires_at > now())
          OR (status = 'offered' AND offer_expires_at > now())
        )
    ),
    count(*) FILTER (
      WHERE position = 'goalie'
        AND (
          status = 'confirmed'
          OR (status = 'held' AND hold_expires_at > now())
          OR (status = 'offered' AND offer_expires_at > now())
        )
    )
  INTO v_skater_taken, v_goalie_taken
  FROM registrations
  WHERE slot_id = p_slot_id;

  PERFORM realtime.send(
    jsonb_build_object(
      'slotId', p_slot_id,
      'skater', jsonb_build_object('taken', coalesce(v_skater_taken, 0), 'capacity', coalesce(v_skater_capacity, 0)),
      'goalie', jsonb_build_object('taken', coalesce(v_goalie_taken, 0), 'capacity', coalesce(v_goalie_capacity, 0))
    ),
    'fill',                        -- event name
    'slot-fill:' || p_slot_id,     -- topic — one channel per slot, so a
                                    -- client only subscribes to the hours
                                    -- it's actually displaying
    false                          -- PUBLIC channel: no auth required to
                                    -- subscribe, no realtime.messages RLS
                                    -- policy to write and get wrong. Fill
                                    -- counts are not secret — see
                                    -- docs/ARCHITECTURE.md and
                                    -- docs/CONTEXT.md §5 on why this
                                    -- avoided a repeat of a previous
                                    -- attempt's RLS debugging session.
  );
END;
$$;

CREATE OR REPLACE FUNCTION broadcast_slot_fill_from_registration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM broadcast_slot_fill(COALESCE(NEW.slot_id, OLD.slot_id));
  RETURN NULL; -- AFTER trigger; return value is ignored either way
END;
$$;

CREATE OR REPLACE FUNCTION broadcast_slot_fill_from_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM broadcast_slot_fill(COALESCE(NEW.slot_id, OLD.slot_id));
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS registrations_broadcast_fill ON registrations';
    EXECUTE '
      CREATE TRIGGER registrations_broadcast_fill
        AFTER INSERT OR UPDATE OR DELETE ON registrations
        FOR EACH ROW
        EXECUTE FUNCTION broadcast_slot_fill_from_registration()
    ';

    EXECUTE 'DROP TRIGGER IF EXISTS slot_capacities_broadcast_fill ON slot_capacities';
    EXECUTE '
      CREATE TRIGGER slot_capacities_broadcast_fill
        AFTER INSERT OR UPDATE OR DELETE ON slot_capacities
        FOR EACH ROW
        EXECUTE FUNCTION broadcast_slot_fill_from_capacity()
    ';
  END IF;
END $$;
