# Summer Ice — State

Mechanical and factual. Regenerated at the end of every session per `CLAUDE.md`'s
session ritual. If this contradicts what a session prompt assumes, the prompt is
probably stale — stop and check, don't work around it.

**Last verified:** 2026-08-10, by reading the repo, querying local Postgres,
running `npx tsc --noEmit` and `pnpm lint:all` project-wide, running the
`packages/core` integration test suite against real local Postgres
(`node --test`, no mocks), driving the three new API routes end-to-end
against a running dev server with `curl` and hand-inserted fixture rows,
and running the concurrency load-test harness twice against real local
Postgres — the actual phase-3 gate, not the earlier small-scale sanity
test. All passed.

---

## Last commit

This file is regenerated as part of the same commit it describes, so it
can't name its own hash in advance — check `git log -1`. That commit
closes out build-order phase 3 (`ARCHITECTURE.md` §12–13): the route
layer for season registration (`apps/web/app/api/registrations/**`), a
correction to waitlist decline/expiry semantics (removes the person from
the queue rather than re-queuing them — was wrong in the previous commit,
caught and fixed same-session), and the load-test harness itself, run and
passing.

## What exists, per package

| Package | One line |
|---|---|
| `packages/db` | Drizzle schema (27 tables), 7 migrations (added `seasons.offer_window_minutes`), seed script (`seed` and `seed:prod`), env/guard-host scripts, realtime health check. `dbDirectPooled(max)` added to `client.ts` for scripts needing real concurrency (the load-test harness). No `outbox` table yet |
| `packages/core` | `slot-fill.ts` (live fill display), `capacity-lock.ts` (the shared `FOR UPDATE` lock + live-count helpers), `registration.ts` (`holdCart`, `confirmCart`, `releaseRegistration`), `waitlist.ts` (`promoteWaitlist`, `declineOffer`). 14 integration tests in `packages/core/test/`, plus `load-test/season-registration.ts` — a separate, on-demand harness (`pnpm --filter @summerice/core run load-test`), not part of the ordinary test run. No attendance or extras-claim functions yet; no accept-offer function (creating the one-line cart on acceptance — see `DOMAIN-MODEL.md` §4, still open) |
| `packages/contracts` | `registration.ts` — Zod request schemas for the registration routes (`holdCartRequestSchema`, `registrationIdParamSchema`). First real content in this package |
| `apps/web` | Next.js App Router. Five UI routes unchanged from before (fake-data, wave-1). **New:** `app/api/registrations/` (`POST`, hold a cart), `app/api/registrations/[id]/release/` (`POST`, withdraw + auto-promote next), `app/api/registrations/[id]/decline/` (`POST`, decline a waitlist offer). All three are thin callers into `packages/core`, per `.claude/rules/web-routes.md`. **No `confirm` route exists, deliberately** — `ARCHITECTURE.md` §4.5 restricts confirmation to the Mollie webhook, which doesn't exist yet (phase 5); exposing it as a plain route now would let anyone confirm a registration without paying |
| `apps/mobile` | Does not exist — not scaffolded, per plan (Phase 4/12) |

### ⚠ The new routes are unauthenticated — a real, known, temporary gap

Supabase Auth doesn't exist yet (`ARCHITECTURE.md` §7, phase 4). The hold
route takes `personId` straight from the request body; release and decline
take a registration id from the URL — neither is checked against any
session, because there is no session mechanism to check against. **Anyone
who can reach these routes can act as any person.** This is acceptable only
because nothing is deployed for real registration and no real money or
real people's data is at stake. These routes must not be wired into
real player-facing UI, and must not go live, until a session-derived
identity replaces the body-supplied `personId`. Each route file has this
same warning inline; recorded here too so it isn't missed by only reading
code.

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
- **Concurrency core — `hold`/`confirm`/`release`/`promote`/`declineOffer` for season registration, against real local Postgres.** 14 `node:test` integration tests, no mocks: mixed carts, a full slot waitlisting instead of failing, waitlist queue position ordering, re-registering an already-held slot coming back as a clean outcome, idempotent webhook confirmation, a release freeing its spot for the next holder, `promoteWaitlist` picking the earliest queued registration, `declineOffer` removing the decliner from the queue entirely (not re-queuing — corrected this session, see below) and promoting the next person in the same call, and `promoteWaitlist` sweeping a lapsed offer out of the queue the same way. Plus one small real-concurrency sanity test — 8 independent connections racing a 1-capacity slot.
- **The load-test harness — built, run, and passing twice.** `packages/core/load-test/season-registration.ts`, `ARCHITECTURE.md` §12's actual gate: 300 concurrent multi-line carts (each the hot 20-capacity slot plus 1-2 slots drawn from a shared 4-slot pool, so contention is real and overlapping, not just on one row), fired via `Promise.allSettled` against a dedicated connection pool (`dbDirectPooled`, new this session in `packages/db/client.ts`). Both runs: **exactly 20 held, exactly 280 waitlisted, 0 rejected calls, 0 partial baskets, 0 duplicate active registrations, database counts agreeing with what the calls reported.** Local Postgres's `max_connections` (100) turned out to be the real ceiling to design around — the first attempt at a 50-connection pool failed with "sorry, too many clients already" against a running `next dev` server and a couple of stray `psql` sessions, a real finding worth knowing before raising the pool size or running this alongside other heavy local Postgres use; settled on 30.
- **The three registration routes, driven end-to-end with `curl` against a running dev server.** Hand-inserted fixture rows (a season, a slot, a 20-capacity `slot_capacities` row, three people) via direct SQL, then: `POST /api/registrations` → 201 with a held line and the correct price; `POST /api/registrations/:id/release` → `withdrawn` + `promoted: empty_queue`; a manually-inserted `offered` row plus a `waitlisted` row, then `POST /api/registrations/:id/decline` → `declined` + the waitlisted person promoted in the same response, confirmed against the database directly (decliner `withdrawn`, promoted person `offered`). All fixture data cleaned up afterward.

**Not verified / not built at all:**

- Accepting a waitlist offer — creating the one-line `registration_carts` row on acceptance is a payment-flow function belonging with `holdCart`/`confirmCart`, not built this session.
- No extras/claims functions (`claims` table, `ice_session_capacities` locking) — phase 11, not phase 3.
- No auth (Supabase Auth behind `credentials`) — decided in `ARCHITECTURE.md` §7, not implemented. **The route layer built this session has no session check as a direct consequence — see the flagged warning above.**
- No outbox table, no Cron endpoints, no notification jobs — decided in `ARCHITECTURE.md` §6, not implemented. `promoteWaitlist`'s "notify" step (DOMAIN-MODEL §4, step 2) is a no-op right now for exactly this reason.
- **The second load-test gate** (`ARCHITECTURE.md` §12, "Load testing against the real Supabase pooler") — this session's harness proves row-locking and capacity correctness against local Postgres only. It does not and cannot prove the Supabase transaction-mode pooler holds up under the same concurrency; that needs the real project and comes later (phase 9, before soft launch).

## Not built yet — the next thing

**Build order phase 3 is done** (`ARCHITECTURE.md` §12–13) — concurrency
core, its integration tests, and the load-test gate all built and passing.
Per the build order, phase 4 is next: **Auth (Supabase Auth behind
`credentials`), family accounts, roles.** This isn't optional busywork
before more registration features — it's what closes the security gap
flagged above (unauthenticated routes trusting a body-supplied `personId`).
`ARCHITECTURE.md` §7 has the design; nothing there is implemented yet.

A second, smaller thread worth naming even though it's not next: accepting
a waitlist offer (the one-line cart on acceptance, `DOMAIN-MODEL.md` §4) —
a natural companion to `declineOffer`, but a payment-flow function that
makes more sense once auth exists to know who's accepting.

**Blocked by:** nothing external for either thread. Auth needs
`@supabase/ssr` wiring in `apps/web` and a `credentials` insert path, both
design-complete per §7; accepting an offer needs nothing but a decision on
whether to build it before or after auth lands.

## Open questions needing a human decision

| # | Question | Owner | Blocks |
|---|---|---|---|
| D12 | Skills Training capacity — split ice, so 20/2 doesn't apply, and at €450/head these are the highest-value slots sold | Cas | Season setup screen, accurate fill display for those two slots |
| — | Vercel plan tier: Hobby's cron limits (2 jobs, daily-max) can't serve near-real-time outbox drain | Michael | Phase 8 (notifications) — budget decision, see `ARCHITECTURE.md` §6 |
| — | Supabase Pro daily backups vs. paid PITR add-on | Michael | Before launch — see `ARCHITECTURE.md` §10 |
| — | Preview deployments currently share Production's Supabase project and have no DB credentials of their own for Preview/Development scopes | Michael | Must resolve via feature branches + Supabase Branching before January, see `ARCHITECTURE.md` §10, §15 |
| — | Error tracking replacement for the retired self-hosted GlitchTip plan | Michael | Not chosen yet; no hard blocker |
| — | Yellow brand color collides with the old amber warning status | design | Phase 6 (registration UI), see `ARCHITECTURE.md` §11 |
