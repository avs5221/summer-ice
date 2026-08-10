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

**Same day, later session:** the homepage (`/`) was restyled from the
"Summer Ice Landing" Claude Design project — see `DECISIONS.md`. Verified
by `npx tsc --noEmit` and `eslint` on every changed file (both clean, one
real `eslint` finding fixed), `curl` against a running dev server reading
the real local database (correct row count, order and live-count text),
and — this time with a working browser — headless Chromium
(`apt-get download` + `dpkg-deb -x` + `LD_LIBRARY_PATH`, no root; the same
workaround a previous session used and this one had to redo from scratch,
since it doesn't persist between sessions) screenshotting light mode,
dark mode after clicking the new toggle, a 420px mobile viewport, and
`/register` to confirm the old plain `Nav` still renders there. Caught and
fixed one real bug this way — a hydration mismatch from the new
theme-init script — that `curl`/`tsc`/`eslint` all missed.

**Same day, third pass:** `apps/web/public/logo-circle.png` shipped
truncated — a real 256 KiB read cap in the `DesignSync` import tool cut
the original mid-`IDAT`, invisible to the checks above because this
sandbox has no `sharp` to actually re-encode it. Michael attached the
correct file directly; replaced, PNG structure verified byte-for-byte
(clean `IEND`), and the same headless-Chromium pass re-run against the
new file plus a reverted copy correction ("iDEAL" → "iDEAL or Wero," per
Michael — Wero is iDEAL's own succession path, not the repo's earlier
guess). Zero console errors, logo confirmed rendering correctly in the
screenshot. Full account in `DECISIONS.md`.

**Same day, fourth pass:** Michael re-sent the original import
instruction; checked state first (per the session ritual) rather than
re-running it blind, found it already shipped, and — since the actual
ask turned out to be "the design project changed, re-sync" — re-fetched
`Summer Ice Landing.dc.html`/`colors_and_type.css` only (not the logo,
deliberately). Real changes: top nav restructured (Home/How it
works/Sign in/Register, "Schedule" and "The rink" dropped as direct nav
links), and the theme toggle moved from a fixed bottom-right floating
button into a small icon button in the footer's link row. Both
implemented; `npx tsc --noEmit` + `eslint` clean, headless-Chromium pass
re-run, zero console errors. Full account in `DECISIONS.md`.

**Same day, fifth pass:** `/register` restyled from the design project's
`Register.dc.html` — the first design-import task on a page that already
had real (fake-data-backed) interactive logic, not a blank slate.
Restyled onto the design's row-state taxonomy (plain/chosen/stale/
full/no-spots-for-me) and sticky-bar layout while keeping — and in one
real case (the "stale" state, unreachable in the design's own static
mock) *extending* — the existing hold/waitlist/contention-demo logic
rather than replacing it with the design's inert seed-data version. New:
`app/site-nav.tsx` (shared nav, now used by both `/` and `/register`),
`app/register/register.module.css`. Rewrote `register-client.tsx` in
full. `npx tsc --noEmit` + `eslint` clean; headless Chromium driven
through real interaction (add/remove, role-mode switching, the
contention demo against both a held and an unheld slot — confirming the
"stale" path is real, not just plausible — dark mode, pay-to-confirm,
420px mobile), zero console errors throughout. Full account in
`DECISIONS.md`.

**Same day, sixth pass:** `/login` restyled from the design project's
`Login.dc.html` — centered auth card, floating theme toggle
(`ThemeToggle` gained a `variant="floating"` for this page's own
un-migrated revision of it), simple centered footer. New:
`app/login/login.module.css`, `app/login/google-signin-button.tsx`.
Tried wiring "Continue with Google" to a real `signInWithOAuth` call
first (Google isn't an enabled provider on the Supabase project yet);
tested it against the real disabled-provider case rather than assuming
it would fail gracefully, found it doesn't (a real browser navigation to
Supabase's raw JSON error, uncatchable in JS even with
`skipBrowserRedirect`), and shipped it disabled instead. The real
email/password `login` server action is unchanged and was exercised
through the new UI with a genuine bad-credentials attempt against the
live Supabase Auth project. `npx tsc --noEmit` + `eslint` clean (one real
lint finding fixed: an async handler passed straight to `onClick`);
headless-Chromium pass — light/dark, mobile, zero console errors, and
confirmed the new `active="login"` nav state doesn't leak onto other
pages. Full account in `DECISIONS.md`.

---

## Last commit

This file is regenerated as part of the same commit it describes, so it
can't name its own hash in advance — check `git log -1`. That commit
restyles `/login` from the design project's `Login.dc.html` — centered
auth card, floating theme toggle, "Continue with Google" shipped
disabled after testing confirmed it can't fail gracefully yet (see
`DECISIONS.md`). Same design-import session, each on its own commit:
`/register` restyled from `Register.dc.html` (row-state schedule table
on top of the existing fake-data hold/waitlist/contention logic, kept
rather than replaced) → the homepage (`/`) re-synced against changes
made to the design project after its initial import (nav restructured,
theme toggle moved into the footer) → a fix swapping in the real
`logo-circle.png` (an earlier commit shipped a truncated one) and
reverting an "iDEAL" copy correction per Michael → the original
landing-page restyle from `Summer Ice Landing.dc.html`. `site-nav.tsx`
and `theme-toggle.tsx` are now shared across all three restyled pages.
Before all of that, a separate session landed the first slice of
build-order phase 4 (`ARCHITECTURE.md` §7): password sign-up/sign-in/
sign-out via Supabase Auth, session handling (`@supabase/ssr`), the
`credentials`/`roles` provisioning and lookup layer in `packages/core`,
and the three season-registration routes rewired to real session
identity, closing the security gap they shipped with on purpose.

## What exists, per package

| Package | One line |
|---|---|
| `packages/db` | Drizzle schema (27 tables), 7 migrations, seed scripts, env/guard-host scripts, realtime health check, `dbDirectPooled(max)`. No `outbox` table yet. **Found this session:** the `sessions` table (`token_hash`, `revoked_at`) is a self-hosted-plan relic nothing uses — Supabase Auth's own JWT/cookie session is authoritative. Left migrated, not dropped; see `ARCHITECTURE.md` §7 and `DOMAIN-MODEL.md` §2 |
| `packages/core` | `slot-fill.ts`, `capacity-lock.ts`, `registration.ts`, `waitlist.ts` (season-registration concurrency core, phase 3, done). **New:** `identity.ts` — `ensurePersonForAuthUser` (the `credentials` insert on first sign-in, idempotent), `getPersonForAuthSubject`, `getPersonRoles`, `personHasRole`. 18 integration tests total (4 new), plus the on-demand `load-test/season-registration.ts` harness. No attendance or extras-claim functions; no accept-offer function; no dependent-promotion function |
| `packages/contracts` | `registration.ts` (unchanged in shape except `personId` removed from `holdCartRequestSchema` — see below) plus **new** `identity.ts` (`signupRequestSchema`, `loginRequestSchema`) |
| `apps/web` | Registration API routes (`app/api/registrations/**`) call `~/lib/auth`'s `requireCurrentPerson`/`requireOwnerOrRole` instead of trusting a body-supplied `personId` — **the hold route's request schema no longer accepts `personId` at all**, it's taken from the session. `app/lib/supabase/server.ts` + `browser.ts` (the `@supabase/ssr` client factories — distinct from the pre-existing `app/lib/supabase-client.ts`, which stays the public, unauthenticated Realtime-only client, on purpose), `proxy.ts` (Next 16's renamed `middleware.ts` — session-cookie refresh only, no redirect gating), `app/lib/auth.ts` (`getCurrentPerson`/`requireCurrentPerson`/`requireOwnerOrRole`), `app/signup/`, `app/lib/auth-actions.ts` (logout). `/schedule`, `/admin` and `/signup` are still fake-data/wave-1, unstyled. **This session:** `/`, `/register` and `/login` all restyled from the "Summer Ice Landing" Claude Design project, sharing `app/site-nav.tsx` and `app/theme-toggle.tsx`. `/` — still `force-dynamic`, still reads `getSlotFillOverview()` for real, now a real nav/hero/stat-band/schedule-table/footer instead of a bullet list (`app/page.module.css`, `app/landing-slot-row.tsx`, replacing the deleted `app/slot-fill-row.tsx`). `/register` — still fake-data (`register-client.tsx` fully rewritten: role-state schedule table, sticky summary bar, `app/register/register.module.css`), but its existing hold/waitlist/contention-demo logic was kept and extended (real "stale" row state), not thrown out for the design's own inert static mock. `/login` — the real `login` server action unchanged, restyled onto a centered auth card (`app/login/login.module.css`); "Continue with Google" (`app/login/google-signin-button.tsx`) is present but `disabled` — Google isn't an enabled Supabase provider yet and testing confirmed `signInWithOAuth` can't fail gracefully in that state (real browser navigation to a raw JSON error, not a catchable JS error). `app/components/nav.tsx` hides itself on all three (each has its own `SiteNav`, now with `active: "home" \| "register" \| "login"`). `globals.css` gained the design's OKLCH token set and switched `dark:` to class strategy site-wide (`@custom-variant dark`); `layout.tsx` gained the theme-init inline script + `suppressHydrationWarning` on `<html>` that makes that safe — see `DECISIONS.md` |
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
- **The restyled homepage (`/`), in a real browser, light and dark, desktop and mobile.** Headless Chromium (Playwright, run via the `apt-get download`/`dpkg-deb -x`/`LD_LIBRARY_PATH` no-root workaround) against a running dev server reading the real local database: screenshotted light mode, clicked the new theme toggle and screenshotted dark mode (confirmed `localStorage`-persisted across a navigation to `/register`, which still renders the original plain `Nav`, not the landing one), and a 420px viewport confirming the hero/stat-band/schedule-table media queries reflow. Zero console errors — but only after fixing one the first pass caught: a hydration mismatch from the theme-init script, invisible to `curl`/`tsc`/`eslint`. `curl` against the same running server independently confirmed the server-rendered HTML: 10 schedule rows in schedule order, "10 of 10 slots still have room" (correct for the empty local `registrations` table), 10 "Claim →" / 0 "Join waitlist" links.
- **Supabase Auth itself is reachable and correctly configured for this project.** A direct `supabase.auth.signUp()` call (plain `@supabase/supabase-js`, the real project, not local) succeeded and returned the expected shape — confirmed email confirmation is **required** for this project (`session: null` on signup, `email_confirmed_at` unset), which is real, useful information: it means `apps/web/app/signup/actions.ts`'s "if `data.session`, go home; otherwise, check-your-email" branch is the branch that actually fires in practice, not a hypothetical. Test user deleted from `auth.users` afterward via the Supabase MCP.
- **An actual browser driving the login form — resolved, for login specifically.** A later session got headless Chromium working (see the live-fill and landing-page entries above and in `DECISIONS.md` for the environment workaround) and used it here too: submitted real bad credentials against `/login`'s Server Action, watched the `login` server action genuinely round-trip to the live Supabase Auth project and return "Invalid login credentials," rendered in the UI's styled error state — not mocked, not just "the page renders." Signup itself (below) is still unverified this way.

**Not verified / not built at all:**

- **An actual browser driving the signup form specifically.** (Login is now verified this way — see above.) Next's Server Actions use React's RSC action-reference wire protocol, not a plain form POST — not curl-able the way the earlier `app/api/*` routes were. What's verified instead for signup: the page renders (200), the underlying Supabase Auth call works end-to-end (above), and the DB-side provisioning logic is proven by real-Postgres tests (above) — but nobody has watched a browser actually submit the signup form and land on a real session yet.
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
