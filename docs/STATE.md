# Summer Ice — State

Mechanical and factual. Regenerated at the end of every session per `CLAUDE.md`'s
session ritual. If this contradicts what a session prompt assumes, the prompt is
probably stale — stop and check, don't work around it.

**Last verified:** 2026-08-10, by reading the repo, querying local Postgres
and the real Supabase project, running `npx tsc --noEmit` and
`pnpm lint:all` project-wide, running the `packages/core` integration
test suite against real local Postgres (`node --test`, no mocks,
including 4 new identity tests), running the concurrency load-test
harness, driving the three registration routes end-to-end with `curl`
against a running dev server both before and after wiring in real auth
(confirming the security gap actually closed — an unauthenticated request
against a real registration id now gets 401, not a successful action),
and a real `supabase.auth.signUp()` call against the live Supabase Auth
service to confirm it's reachable and correctly configured. All passed.
**Not verified: an actual browser driving the signup/login forms through
Next's Server Action wire protocol** — no browser-automation tool was
available this session; see "Not verified" below.

---

## Last commit

This file is regenerated as part of the same commit it describes, so it
can't name its own hash in advance — check `git log -1`. That commit lands
the first slice of build-order phase 4 (`ARCHITECTURE.md` §7): password
sign-up/sign-in/sign-out via Supabase Auth, session handling
(`@supabase/ssr`), the `credentials`/`roles` provisioning and lookup layer
in `packages/core`, and — the actual point of doing this now — the three
season-registration routes from the previous commit rewired to real
session identity, closing the security gap they shipped with on purpose.

## What exists, per package

| Package | One line |
|---|---|
| `packages/db` | Drizzle schema (27 tables), 7 migrations, seed scripts, env/guard-host scripts, realtime health check, `dbDirectPooled(max)`. No `outbox` table yet. **Found this session:** the `sessions` table (`token_hash`, `revoked_at`) is a self-hosted-plan relic nothing uses — Supabase Auth's own JWT/cookie session is authoritative. Left migrated, not dropped; see `ARCHITECTURE.md` §7 and `DOMAIN-MODEL.md` §2 |
| `packages/core` | `slot-fill.ts`, `capacity-lock.ts`, `registration.ts`, `waitlist.ts` (season-registration concurrency core, phase 3, done). **New:** `identity.ts` — `ensurePersonForAuthUser` (the `credentials` insert on first sign-in, idempotent), `getPersonForAuthSubject`, `getPersonRoles`, `personHasRole`. 18 integration tests total (4 new), plus the on-demand `load-test/season-registration.ts` harness. No attendance or extras-claim functions; no accept-offer function; no dependent-promotion function |
| `packages/contracts` | `registration.ts` (unchanged in shape except `personId` removed from `holdCartRequestSchema` — see below) plus **new** `identity.ts` (`signupRequestSchema`, `loginRequestSchema`) |
| `apps/web` | Five UI routes still fake-data, wave-1, unchanged. Registration API routes (`app/api/registrations/**`, built last session) now call `~/lib/auth`'s `requireCurrentPerson`/`requireOwnerOrRole` instead of trusting a body-supplied `personId` — **the hold route's request schema no longer accepts `personId` at all**, it's taken from the session. **New:** `app/lib/supabase/server.ts` + `browser.ts` (the `@supabase/ssr` client factories — distinct from the pre-existing `app/lib/supabase-client.ts`, which stays the public, unauthenticated Realtime-only client, on purpose), `proxy.ts` (Next 16's renamed `middleware.ts` — session-cookie refresh only, no redirect gating), `app/lib/auth.ts` (`getCurrentPerson`/`requireCurrentPerson`/`requireOwnerOrRole`), `app/signup/`, `app/login/`, `app/lib/auth-actions.ts` (logout) |
| `apps/mobile` | Does not exist — not scaffolded, per plan (Phase 4/12) |

### The registration routes' security gap is closed for the case tested

The gap flagged when `app/api/registrations/**` was first built (previous
session) — `personId` trusted from the request body, no session check —
is closed: `POST /api/registrations` now takes the person from
`getCurrentPerson()`, and release/decline both check the target
registration's owner against the session (or an `admin` role) via
`requireOwnerOrRole` before calling into `packages/core`. Confirmed live:
an unauthenticated `curl` against a real registration id now returns `401
{"error":"authentication required"}` where it previously succeeded.
**What's still open:** dependents can't act through a guardian yet
(`requireOwnerOrRole` only knows "is this the resource's own person, or
an admin" — no guardian-for-dependent path), and nothing in `apps/web`'s
UI actually calls these routes with a real session cookie yet (no
signed-in registration flow exists, just the API layer + a bare
signup/login form).

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
connect as the `postgres` role, which bypasses RLS entirely. **Supabase
Auth now exists (this session) — still harmless, because the specific
trigger condition still hasn't happened**: a browser client querying a
table directly with a user's JWT, which nothing in `apps/web` does. Auth
sessions here only ever inform a server-side check (`app/lib/auth.ts`)
that then queries via Drizzle/`postgres`, same as before. The day this
stops being harmless is the day something in the browser calls
`supabase-js` against a table directly with the session's JWT — watch for
that, not for "Auth exists" as the trigger. See `ARCHITECTURE.md` §5 for
the full reasoning and the two options for when that day comes.

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
- **The three registration routes, driven end-to-end with `curl` against a running dev server.** Hand-inserted fixture rows via direct SQL, then: `POST /api/registrations` → 201 with a held line and the correct price; `POST /api/registrations/:id/release` → `withdrawn` + `promoted: empty_queue`; a manually-inserted `offered` row plus a `waitlisted` row, then `POST /api/registrations/:id/decline` → `declined` + the waitlisted person promoted in the same response, confirmed against the database directly. All fixture data cleaned up afterward.
- **Identity provisioning and lookup (`packages/core/identity.ts`), against real local Postgres.** 4 `node:test` integration tests, no mocks: `ensurePersonForAuthUser` provisions a new `people` + `credentials` row on first call and is idempotent on a second call for the same subject (no duplicate person); `getPersonForAuthSubject` returns null for an unlinked subject; `getPersonRoles`/`personHasRole` correctly reflect an inserted `roles` row and default to empty/false.
- **The registration routes' auth check, against the real request pipeline (not just unit tests).** `curl -X POST /api/registrations` with no session cookie → `401 {"error":"authentication required"}` (previously: 201, since `personId` was trusted from the body). Same check against `/api/registrations/:id/release` and `/decline` with a **real** registration id (so the check reaches the ownership branch, not just "not found") → also 401. Confirms the gap flagged in the previous session's `STATE.md` is actually closed at the HTTP layer, not just in code that looks right.
- **Supabase Auth itself is reachable and correctly configured for this project.** A direct `supabase.auth.signUp()` call (plain `@supabase/supabase-js`, the real project, not local) succeeded and returned the expected shape — confirmed email confirmation is **required** for this project (`session: null` on signup, `email_confirmed_at` unset), which is real, useful information: it means `apps/web/app/signup/actions.ts`'s "if `data.session`, go home; otherwise, check-your-email" branch is the branch that actually fires in practice, not a hypothetical. Test user deleted from `auth.users` afterward via the Supabase MCP.

**Not verified / not built at all:**

- **An actual browser driving the signup/login forms.** Next's Server Actions use React's RSC action-reference wire protocol, not a plain form POST — not curl-able the way the earlier `app/api/*` routes were. No browser-automation tool (Playwright/Chromium) was set up this session; the previous session's headless-Chromium environment workaround (documented in `DECISIONS.md`, 2026-08-09/10) didn't persist into this one. What's verified instead: the pages render (200), the underlying Supabase Auth call works end-to-end (above), and the DB-side provisioning logic is proven by real-Postgres tests (above) — but nobody has watched a browser actually submit the signup form and land on a real session yet.
- Google, Apple OAuth providers — password only. See `ARCHITECTURE.md` §7's "Not built yet" list for the full remainder (dependent promotion, guardian-acts-for-dependent authorization, email one-tap actions, multi-provider identity merging).
- Accepting a waitlist offer — creating the one-line `registration_carts` row on acceptance is a payment-flow function belonging with `holdCart`/`confirmCart`, not built this session, though auth existing now removes the reason it was previously deferred.
- No extras/claims functions (`claims` table, `ice_session_capacities` locking) — phase 11.
- No outbox table, no Cron endpoints, no notification jobs — decided in `ARCHITECTURE.md` §6, not implemented.
- **The second load-test gate** (`ARCHITECTURE.md` §12, "Load testing against the real Supabase pooler") — phase 3's harness proves row-locking and capacity correctness against local Postgres only; the real pooler needs its own gate later (phase 9).

## Not built yet — the next thing

**Phase 4's first slice is done: password auth, sessions, role-gating
plumbing, and the registration routes wired to real identity.** Not done:
Google/Apple, family accounts/dependent promotion, and any UI that
actually uses a signed-in session for something a player would recognize
as "registering" (the wave-1 `/register` page is still fake-data and
doesn't call the real routes yet). The natural next thing is picking one
of those — most likely wiring `/register` to the real `holdCart` route
behind a real signed-in session, since that's what makes phase 3 and this
session's work actually reachable by a person instead of only by `curl`
and tests.

Accepting a waitlist offer (the one-line cart on acceptance,
`DOMAIN-MODEL.md` §4) is a second, smaller thread — a natural companion to
`declineOffer`, and no longer blocked on auth now that auth exists.

**Blocked by:** nothing external for either thread.

## Open questions needing a human decision

| # | Question | Owner | Blocks |
|---|---|---|---|
| D12 | Skills Training capacity — split ice, so 20/2 doesn't apply, and at €450/head these are the highest-value slots sold | Cas | Season setup screen, accurate fill display for those two slots |
| — | Vercel plan tier: Hobby's cron limits (2 jobs, daily-max) can't serve near-real-time outbox drain | Michael | Phase 8 (notifications) — budget decision, see `ARCHITECTURE.md` §6 |
| — | Supabase Pro daily backups vs. paid PITR add-on | Michael | Before launch — see `ARCHITECTURE.md` §10 |
| — | Preview deployments currently share Production's Supabase project and have no DB credentials of their own for Preview/Development scopes | Michael | Must resolve via feature branches + Supabase Branching before January, see `ARCHITECTURE.md` §10, §15 |
| — | Error tracking replacement for the retired self-hosted GlitchTip plan | Michael | Not chosen yet; no hard blocker |
| — | Yellow brand color collides with the old amber warning status | design | Phase 6 (registration UI), see `ARCHITECTURE.md` §11 |
