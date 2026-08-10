# Summer Ice — State

Mechanical and factual. Regenerated at the end of every session per `CLAUDE.md`'s
session ritual. If this contradicts what a session prompt assumes, the prompt is
probably stale — stop and check, don't work around it.

**Last verified:** 2026-08-10, by reading the repo, querying both databases, and
running `tsc --noEmit` directly — not written from memory or assumption.

---

## Last commit

`33cbbcd` — "fix: resolve vercel supabase env var names and render homepage
dynamically" — 2026-08-10. One commit ahead of `origin/main` (unpushed).

## What exists, per package

| Package | One line |
|---|---|
| `packages/db` | Drizzle schema (27 tables), 6 migrations, seed script, env/guard-host scripts, realtime health check. No `outbox` table yet |
| `packages/core` | One module: `slot-fill.ts` (computes live season-registration fill, mirrors the Realtime trigger's formula). No capacity-lock, claim, or attendance functions yet |
| `packages/contracts` | Scaffolded (`index.ts`, zod dependency present), no schemas written yet |
| `apps/web` | Next.js App Router. Five routes: `/` (real data, live), `/register`, `/schedule`, `/admin`, `/admin/session/[id]` (all four fake-data, wave-1 UI) |
| `apps/mobile` | Does not exist — not scaffolded, per plan (Phase 4/12) |

## Database

**27 tables, 6 migrations, in both environments — schema is in sync.**

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
| `ice_sessions` | **220 rows** (generated dated sessions) | **0 rows** |

**Where they differ:** only `ice_sessions` — local has the full generated set
of dated sessions for the season, Supabase does not. Nothing else diverges.

**Noteworthy, not a bug:** every table on the Supabase project has RLS
*enabled* with zero policies (Supabase's own `rls_auto_enable` platform
default, not something this codebase's migrations set — `grep` for `ROW
LEVEL SECURITY` across `packages/db/migrations/*.sql` returns nothing). This
doesn't contradict `ARCHITECTURE.md` §5's "no RLS on application data" —
Drizzle connects directly as a role that bypasses RLS, so nothing is
currently blocked — but it's a live security-advisor finding
(`rls_enabled_no_policy`, INFO-level, on every table) worth knowing about
before anything ever adds a PostgREST or `supabase-js` read path that isn't
the Realtime channel.

## Verified

What has genuinely been proven, versus what merely compiles:

- **Compiles.** `npx tsc --noEmit`, project-wide root check: 0 errors, as of this commit.
- **Schema constraints, against a live database.** Migrations have been applied to both a local and the real Supabase Postgres; every table, FK and check constraint exists as designed in both.
- **`uuidv7()` shim correctness.** Per `ARCHITECTURE.md` §5, verified with 5,000 generated values against a real Postgres 17 container and cross-checked against Postgres 18's native builtin — not by inspection.
- **Live fill — trigger and WebSocket layer only.** The Supabase Realtime broadcast trigger (`0005_live_fill_broadcast.sql`) and the browser-side subscription hook (`use-live-fill.ts`) exist and are wired up. **This has never been exercised end-to-end through the actual homepage in a browser** — no one has opened `/`, changed a registration row, and watched the number update live. The trigger firing, the broadcast arriving, and the hook updating have each been reasoned about and code-reviewed, not observed together.
- **Homepage (`/`) reads real data.** Confirmed `force-dynamic`, confirmed it queries `dbPooled()` and `getSlotFillOverview` rather than fake data.

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
