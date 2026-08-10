# Summer Ice — State

Mechanical and factual. Regenerated at the end of every session per `CLAUDE.md`'s
session ritual. If this contradicts what a session prompt assumes, the prompt is
probably stale — stop and check, don't work around it.

**Last verified:** 2026-08-10, by reading the repo, querying local Postgres,
running `npx tsc --noEmit` and `pnpm lint:all` project-wide, and running the
new `packages/core` integration test suite against real local Postgres
(`node --test`, no mocks).

---

## Last commit

This file is regenerated as part of the same commit it describes, so it
can't name its own hash in advance — check `git log -1`. That commit is
this session's concurrency-core work: `hold`/`confirm`/`release`/`promote`
for season registration in `packages/core`, a new `seasons.offer_window_minutes`
migration, and 11 passing integration tests.

## What exists, per package

| Package | One line |
|---|---|
| `packages/db` | Drizzle schema (27 tables), 7 migrations (added `seasons.offer_window_minutes`), seed script (`seed` and `seed:prod`), env/guard-host scripts, realtime health check. No `outbox` table yet |
| `packages/core` | `slot-fill.ts` (live fill display), `capacity-lock.ts` (the shared `FOR UPDATE` lock + live-count helpers), `registration.ts` (`holdCart`, `confirmCart`, `releaseRegistration`), `waitlist.ts` (`promoteWaitlist`). 11 integration tests in `packages/core/test/`, real local Postgres, no mocks. No attendance or extras-claim functions yet; no accept/decline-offer function (see `DOMAIN-MODEL.md` §4's "Open, not yet implemented" note) |
| `packages/contracts` | Scaffolded (`index.ts`, zod dependency present), no schemas written yet |
| `apps/web` | Next.js App Router. Five routes: `/` (real data, live), `/register`, `/schedule`, `/admin`, `/admin/session/[id]` (all four fake-data, wave-1 UI). Nothing in `apps/web` calls the new `packages/core` registration functions yet — they exist only as tested library code so far |
| `apps/mobile` | Does not exist — not scaffolded, per plan (Phase 4/12) |

## Database

**27 tables, 7 migrations locally; Supabase still on 6 — see below.**

| | Local Docker (`packages/db/docker-compose.yml`) | Supabase project |
|---|---|---|
| Postgres version | 18.4 | 17.6 |
| `uuidv7()` shim active | No — 18 has it natively, migration no-ops there | Yes — confirmed present and in use |
| Migrations applied | 7/7 (`drizzle.__drizzle_migrations`) — added `0006_season_offer_window.sql` this session | **6/6 — `0006` not yet applied to Supabase.** `pnpm db:migrate:prod` needs to be run before anything reads/writes `seasons.offer_window_minutes` against the real project |
| `realtime` schema | Absent — plain Postgres has none | Present (Supabase-managed) |
| `people`, `registrations`, `ledger_entries`, `attendances`, `claims`, `payments` | 0 rows (empty) | 0 rows (empty) |
| `levels` | 6 rows (seeded) | 6 rows (seeded) |
| `seasons` | 1 row (seeded) | 1 row (seeded) |
| `slots` / `slot_capacities` / `slot_levels` | 10 / 20 / 14 rows (seeded, the real 2026 schedule) | 10 / 20 / 14 rows (seeded, same) |
| `ice_sessions` | 220 rows (generated dated sessions) | **220 rows — seeded this session, via the new `db:seed:prod` script.** Confirmed idempotent: ran twice, counts unchanged both times |

**One divergence right now, introduced this session and not yet closed:**
migration `0006_season_offer_window.sql` (adds `seasons.offer_window_minutes`,
default 60) is applied locally but not against the real Supabase project —
this session's work never ran `pnpm db:migrate:prod`, deliberately, since
nothing in `apps/web` reads that column yet and there was no reason to touch
production for a column nothing uses. Run the prod migration before any
future session wires `promoteWaitlist` into a route or admin UI that expects
the column to exist there. Row counts otherwise remain identical to the
prior version of this file — `ice_sessions` seeded on both, nothing else
changed.

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
- **Live fill — fully proven end-to-end, in a real browser, against the deployed site.** 2026-08-10 (two sessions): the first diagnosed a reported "numbers never update live" symptom by comparing the trigger's broadcast against the client's subscription (topic, event name, public/private all matched) and then, empirically, confirmed a standalone Node script received a real broadcast — concluding the pipeline worked but had never been *watched* in a browser, and added unconditional `console.debug` logging to `use-live-fill.ts` for exactly that purpose. The second session closed that remaining gap: drove headless Chromium (Playwright) against `https://summer-ice-kappa.vercel.app/`, confirmed all 10 `[live-fill] ... SUBSCRIBED` lines on load, changed a live `slot_capacities.capacity` row via the Supabase MCP while the page stayed open, observed the `[live-fill] message on ...` console line arrive ~22s later, and confirmed the rendered DOM itself changed (`0/18 skaters`, matching the change) with no refresh — ruling out the "stale value reasserted on next render" failure mode this hook has had before. No CSP violations (the deployed page sends no `Content-Security-Policy` header at all), no console errors, no failed requests other than one unrelated aborted Next.js RSC prefetch. **There is no known live-fill bug right now.** Full account, including the environment workaround needed to run a browser at all (no browser-automation MCP tool present, and headless Chromium's shared libs had to be fetched without root via `apt-get download` + `dpkg-deb -x` + `LD_LIBRARY_PATH`), in `DECISIONS.md`.
- **Homepage (`/`) reads real data.** Confirmed `force-dynamic`, confirmed it queries `dbPooled()` and `getSlotFillOverview` rather than fake data.
- **`getSlotFillOverview` against the real Supabase project.** Run directly (not through the web app) after seeding: returns all 10 rows, each with a correct next-upcoming `ice_session`, matching the seeded schedule and today's date. This confirms the data and the query are right; it is **not** the same as the browser-level live-fill check above, which is still unproven end-to-end.
- **Concurrency core — `hold`/`confirm`/`release`/`promote` for season registration, against real local Postgres.** 11 `node:test` integration tests, no mocks: mixed carts (one line held, one waitlisted, correct total), a full slot waitlisting instead of failing, waitlist queue position ordering, re-registering an already-held slot coming back as a clean outcome rather than a duplicate row, idempotent webhook confirmation, a release freeing its spot for the next holder, and `promoteWaitlist` picking the earliest queued registration with the season's configured offer window. Plus one **real independent-connection concurrency test** — 8 separate transactions on separate connections racing `Promise.all` against a 1-capacity slot — proving the row lock serializes actual concurrent connections, not just sequential calls sharing one transaction. This is **not** the load-test gate itself (`ARCHITECTURE.md` §12 wants several hundred concurrent multi-line carts against a 20-capacity slot) — it's a fast sanity check that the mechanism the load test will exercise actually holds.

**Not verified / not built at all:**

- **The load-test harness itself** — several hundred concurrent multi-line carts with overlapping slot sets against a 20-capacity slot, asserting exactly 20 winners, no partial baskets, no deadlocks. `ARCHITECTURE.md` §12 calls this "the real gate," not the 8-connection sanity test above.
- Accepting or declining a waitlist offer — `promoteWaitlist` only implements finding-and-offering; see `DOMAIN-MODEL.md` §4's "Open, not yet implemented" note on why (a real spec gap around decline/re-queue semantics, not a scheduling gap).
- No extras/claims functions (`claims` table, `ice_session_capacities` locking) — phase 11, not phase 3.
- No auth (Supabase Auth behind `credentials`) — decided in `ARCHITECTURE.md` §7, not implemented.
- No outbox table, no Cron endpoints, no notification jobs — decided in `ARCHITECTURE.md` §6, not implemented. `promoteWaitlist`'s "notify" step (DOMAIN-MODEL §4, step 2) is a no-op right now for exactly this reason.
- Nothing in `apps/web` calls any of these new `packages/core` functions yet — no registration route, no server action. They're tested library code, not a working registration flow.

## Not built yet — the next thing

**The load-test harness** (`ARCHITECTURE.md` §12–13, the rest of build order
phase 3): a script firing several hundred concurrent multi-line carts with
overlapping slot sets at a 20-capacity slot via `holdCart`, asserting
exactly 20 winners, never 21, no partial baskets, no deadlocks, no duplicate
registrations. The mechanism it needs to exercise (`holdCart`,
`lockSlotCapacities`) is now built and unit-proven at small scale (8
connections); this harness is what proves it at the scale January actually
needs. Nothing downstream — real registration routes, real payment — should
be built ahead of this.

**Blocked by:** nothing external. Pure test-harness work against
`packages/core` as it now stands.

## Open questions needing a human decision

| # | Question | Owner | Blocks |
|---|---|---|---|
| D12 | Skills Training capacity — split ice, so 20/2 doesn't apply, and at €450/head these are the highest-value slots sold | Cas | Season setup screen, accurate fill display for those two slots |
| — | Waitlist offer decline/expiry: does the same registration row re-queue (at what `waitlist_joined_at`), or is it retired and a fresh entry needed? `DOMAIN-MODEL.md` §4's diagram doesn't say | Michael / Cas | Building accept/decline-offer functions in `packages/core` |
| — | Vercel plan tier: Hobby's cron limits (2 jobs, daily-max) can't serve near-real-time outbox drain | Michael | Phase 8 (notifications) — budget decision, see `ARCHITECTURE.md` §6 |
| — | Supabase Pro daily backups vs. paid PITR add-on | Michael | Before launch — see `ARCHITECTURE.md` §10 |
| — | Preview deployments currently share Production's Supabase project and have no DB credentials of their own for Preview/Development scopes | Michael | Must resolve via feature branches + Supabase Branching before January, see `ARCHITECTURE.md` §10, §15 |
| — | Error tracking replacement for the retired self-hosted GlitchTip plan | Michael | Not chosen yet; no hard blocker |
| — | Yellow brand color collides with the old amber warning status | design | Phase 6 (registration UI), see `ARCHITECTURE.md` §11 |
