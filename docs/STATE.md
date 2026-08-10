# Summer Ice — State

Mechanical and factual. Regenerated at the end of every session per `CLAUDE.md`'s
session ritual. If this contradicts what a session prompt assumes, the prompt is
probably stale — stop and check, don't work around it.

**Last verified:** 2026-08-10, by reading the repo, querying both databases,
running `tsc --noEmit` directly, and — new this session — running a
standalone script against the real Supabase Realtime endpoint to observe an
actual broadcast arrive, not just reading the code that should produce one.

---

## Last commit

`508648c` — "chore: seed ice_sessions on supabase, document rls posture" —
2026-08-10, matches `origin/main` (this repo pushes promptly; Vercel's latest
production deployment is built from this exact commit — confirmed via the
Vercel API, not assumed). This session's own work (live-fill diagnosis,
diagnostic logging) lands in the commit right after this file is
regenerated — check `git log -1` if you need the exact hash.

## What exists, per package

| Package | One line |
|---|---|
| `packages/db` | Drizzle schema (27 tables), 6 migrations, seed script (now `seed` and `seed:prod`), env/guard-host scripts, realtime health check. No `outbox` table yet |
| `packages/core` | One module: `slot-fill.ts` (computes live season-registration fill, mirrors the Realtime trigger's formula). No capacity-lock, claim, or attendance functions yet |
| `packages/contracts` | Scaffolded (`index.ts`, zod dependency present), no schemas written yet |
| `apps/web` | Next.js App Router. Five routes: `/` (real data, live), `/register`, `/schedule`, `/admin`, `/admin/session/[id]` (all four fake-data, wave-1 UI) |
| `apps/mobile` | Does not exist — not scaffolded, per plan (Phase 4/12) |

## Database

**27 tables, 6 migrations, in both environments — schema and seed data are now
fully in sync.**

| | Local Docker (`packages/db/docker-compose.yml`) | Supabase project |
|---|---|---|
| Postgres version | 18.4 | 17.6 |
| `uuidv7()` shim active | No — 18 has it natively, migration no-ops there | Yes — confirmed present and in use |
| Migrations applied | 6/6 (`drizzle.__drizzle_migrations`) | 6/6 (same 6 hashes) |
| `realtime` schema | Absent — plain Postgres has none | Present (Supabase-managed) |
| `people`, `registrations`, `ledger_entries`, `attendances`, `claims`, `payments` | 0 rows (empty) | 0 rows (empty) |
| `levels` | 6 rows (seeded) | 6 rows (seeded) |
| `seasons` | 1 row (seeded) | 1 row (seeded) |
| `slots` / `slot_capacities` / `slot_levels` | 10 / 20 / 14 rows (seeded, the real 2026 schedule) | 10 / 20 / 14 rows (seeded, same) |
| `ice_sessions` | 220 rows (generated dated sessions) | **220 rows — seeded this session, via the new `db:seed:prod` script.** Confirmed idempotent: ran twice, counts unchanged both times |

**Nothing currently diverges between the two environments.** The one gap
recorded in the prior version of this file (`ice_sessions` empty on
Supabase, so the deployed homepage had nothing to read fill against) is
closed.

**RLS posture — deliberate, now written down in `ARCHITECTURE.md` §5, not
just noted here.** Every table on the Supabase project has RLS *enabled*
with zero policies (a Supabase platform default — `grep` for `ROW LEVEL
SECURITY` across `packages/db/migrations/*.sql` returns nothing; this
codebase never set it). Harmless today because `dbDirect()`/`dbPooled()`
connect as the `postgres` role, which bypasses RLS entirely. **Not harmless
once Supabase Auth ships**: a browser client querying a table directly with
a user's JWT will be denied everything, silently, and it will look like an
application bug rather than an RLS message. See `ARCHITECTURE.md` §5 for the
full reasoning and the two options for when that day comes.

## Verified

What has genuinely been proven, versus what merely compiles:

- **Compiles.** `npx tsc --noEmit`, project-wide root check: 0 errors, as of this commit.
- **Schema constraints, against a live database.** Migrations have been applied to both a local and the real Supabase Postgres; every table, FK and check constraint exists as designed in both.
- **`uuidv7()` shim correctness.** Per `ARCHITECTURE.md` §5, verified with 5,000 generated values against a real Postgres 17 container and cross-checked against Postgres 18's native builtin — not by inspection.
- **Live fill — the transport mechanism, proven; the actual homepage in a browser, still not.** 2026-08-10: diagnosed a report that the deployed homepage's numbers never update live. Directly compared the trigger's broadcast (queried from `realtime.messages` on the live project) against the client's subscription (`use-live-fill.ts`) — topic (`slot-fill:<slots.id>`, both sides), event name (`fill`, both sides), and public/private (`false`, both sides) all matched exactly; no mismatch existed. Confirmed the live Vercel deployment was built from the current `origin/main` HEAD, ruling out the staleness trap `CLAUDE.md` warns about. With code comparison exhausted, verified empirically instead: a standalone Node script using the same `@supabase/supabase-js` client, URL and publishable key subscribed to the same channel and received a real broadcast within seconds of an `UPDATE` on `slot_capacities`. **The full pipeline — trigger → `realtime.send` → replication → channel broadcast → client callback — genuinely works.** See `DECISIONS.md` for the full account. What was missing was observability, now fixed: `use-live-fill.ts` logs subscribe status and every message via `console.debug`, unconditionally (works on the deployed site, not just local dev). **What remains unverified is narrower than before but still real: no one has opened the actual deployed `/` in a browser and watched a number change.** To confirm: open the deployed `/` with devtools open, look for `[live-fill] slot-fill:<uuid> subscription status: SUBSCRIBED` (one per visible slot) shortly after load, then change any `slot_capacities.capacity` on the live project — the console should log `[live-fill] message on slot-fill:<uuid>: {...}` immediately and the row's number should update with no refresh.
- **Homepage (`/`) reads real data.** Confirmed `force-dynamic`, confirmed it queries `dbPooled()` and `getSlotFillOverview` rather than fake data.
- **`getSlotFillOverview` against the real Supabase project.** Run directly (not through the web app) after seeding: returns all 10 rows, each with a correct next-upcoming `ice_session`, matching the seeded schedule and today's date. This confirms the data and the query are right; it is **not** the same as the browser-level live-fill check above, which is still unproven end-to-end.

**Not verified / not built at all:**

- No automated tests exist anywhere in the repo (`find . -iname "*.test.ts" -o -iname "*.spec.ts"` returns nothing) — not the `packages/core` integration tests, not the concurrency load harness, both called for in `ARCHITECTURE.md` §12 and marked "the real gate" for this phase.
- No capacity-locking, hold, claim, or waitlist-promotion function exists in `packages/core` — only fill computation.
- No auth (Supabase Auth behind `credentials`) — decided in `ARCHITECTURE.md` §7, not implemented.
- No outbox table, no Cron endpoints, no notification jobs — decided in `ARCHITECTURE.md` §6, not implemented.

## Not built yet — the next thing

**The concurrency core and its load test** (`ARCHITECTURE.md` §12–13, build
order phase 3): `hold` / `confirm` / `release` / `promote` / `claim` functions
in `packages/core`, tested against real Postgres, then a harness firing
several hundred concurrent multi-line carts at a 20-capacity slot and
asserting exactly 20 winners. Nothing downstream — real registration, real
payment — should be built ahead of this; it's the one `ARCHITECTURE.md` calls
non-negotiable before anything else is trusted with real money.

**Blocked by:** nothing external. This is pure `packages/core` + test-harness
work against the schema that already exists.

## Open questions needing a human decision

| # | Question | Owner | Blocks |
|---|---|---|---|
| D12 | Skills Training capacity — split ice, so 20/2 doesn't apply, and at €450/head these are the highest-value slots sold | Cas | Season setup screen, accurate fill display for those two slots |
| — | Vercel plan tier: Hobby's cron limits (2 jobs, daily-max) can't serve near-real-time outbox drain | Michael | Phase 8 (notifications) — budget decision, see `ARCHITECTURE.md` §6 |
| — | Supabase Pro daily backups vs. paid PITR add-on | Michael | Before launch — see `ARCHITECTURE.md` §10 |
| — | Preview deployments currently share Production's Supabase project and have no DB credentials of their own for Preview/Development scopes | Michael | Must resolve via feature branches + Supabase Branching before January, see `ARCHITECTURE.md` §10, §15 |
| — | Error tracking replacement for the retired self-hosted GlitchTip plan | Michael | Not chosen yet; no hard blocker |
| — | Yellow brand color collides with the old amber warning status | design | Phase 6 (registration UI), see `ARCHITECTURE.md` §11 |
