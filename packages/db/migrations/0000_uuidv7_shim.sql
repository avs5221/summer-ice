-- uuidv7() compatibility shim — see docs/ARCHITECTURE.md §5.
--
-- The schema convention (`uuid primary key default uuidv7()`, every table,
-- packages/db/schema/_columns.ts) assumes Postgres 18's native built-in.
-- Supabase's hosted Postgres is currently 17.x, where uuidv7() does not
-- exist at all — every table-creating migration would fail on its first
-- INSERT the moment a default fires. This is NOT a schema change: the
-- convention in §5 is correct for where Supabase is headed, this just
-- covers the gap until it gets there.
--
-- Pure SQL, RFC 9562 §5.7 compliant:
--   - bytes 0-5  (48 bits): Unix timestamp in milliseconds, big-endian
--   - byte 6 high nibble:   version = 0111 (7)
--   - byte 8 top 2 bits:    variant = 10
--   - all remaining bits:   random, from gen_random_bytes (pgcrypto)
--
-- Guarded so this is a genuine no-op once Supabase ships Postgres 18:
-- `to_regprocedure('uuidv7()')` resolves an unqualified zero-arg call
-- exactly the way `_columns.ts`'s `default(sql\`uuidv7()\`)` does, via the
-- normal search_path — so the moment a real built-in shadows this name,
-- the migration (if it ever ran again) would skip creating the shim, and
-- existing databases keep using whichever definition search_path resolves
-- first. Nothing here should be run again once Postgres 18 is confirmed;
-- at that point this file's function can simply be dropped
-- (`drop function if exists public.uuidv7();`) in a follow-up migration.
--
-- Verified (not just inspected): several thousand generated values are
-- unique, sort in generation order, decode to version 7 / variant 10, and
-- their embedded timestamp matches wall-clock time at generation — see the
-- session that added this file for the verification script. Tested against
-- local Postgres 18 (where this is shadowed by the real built-in — pgcrypto
-- is required for gen_random_bytes either way) and against a simulated
-- Postgres 17 (the built-in dropped inside a rolled-back transaction).
create extension if not exists pgcrypto;

do $migration$
begin
  if to_regprocedure('uuidv7()') is null then
    execute $create_stmt$
      create function public.uuidv7()
      returns uuid
      language sql
      volatile
      parallel safe
      as $func_body$
        with params as (
          select
            gen_random_bytes(16) as rand16,
            -- int8send() is 8 bytes, big-endian; the top 2 are always zero
            -- for any millisecond timestamp before the year ~10889, so
            -- substring(... from 3) keeps exactly the low 48 bits.
            substring(
              int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
              from 3
            ) as ts6
        ),
        with_ts as (
          select overlay(rand16 placing ts6 from 1 for 6) as bytes
          from params
        )
        select encode(
          set_byte(
            set_byte(
              bytes,
              6,
              (get_byte(bytes, 6) & 15) | 112  -- clear high nibble, OR in 0111 (version 7)
            ),
            8,
            (get_byte(bytes, 8) & 63) | 128    -- clear top 2 bits, OR in 10 (variant)
          ),
          'hex'
        )::uuid
        from with_ts;
      $func_body$;
    $create_stmt$;
  end if;
end;
$migration$;
