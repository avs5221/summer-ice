# Summer Ice — Decisions

Append-only. A decision gets a new entry when it's made or reversed; existing
entries are never edited except to add a reversal pointer. Each entry names
its rationale briefly and points at the canonical document section for the
full reasoning — this log is the *when and why*, not a restatement of the
spec.

Dates before this repository existed are approximate (the design
conversation that produced `DOMAIN-MODEL.md`, `ARCHITECTURE.md` and
`CONTEXT.md` predates the first commit, per `ROADMAP.md` Part 3); dates from
the first commit onward are exact, taken from `git log`.

---

### 2026-08-09 (pre-repo) — Twelve behavioural decisions settled before any code

Attendance resolves unanswered as out (D1), no vetting gate on extras claims
(D2), goalie pricing structure (D3), coach payables in the ledger (D4),
Naomi's financial exclusion (D5), roster visibility format (D6), interest
list size driving push-as-load-bearing (D7), extras late-withdrawal cutoff
(D8), auto-flag heuristic (D9), goalie claim spam protection instead of a
gate (D10), and the per-transition (not per-spot) notification unit (D11).

**Why recorded as one entry:** all twelve were settled together, before
`apps/web` or `packages/db` existed, specifically to avoid attempt 2's
failure — eight screen/component specs written before anyone wrote down what
the system does, four of which went stale within a week. See
`DOMAIN-MODEL.md` §14 for the full table and `CONTEXT.md` §5 for why
behaviour-first was the deliberate response to that failure.

**Left open:** D12, Skills Training capacity — split ice, 20/2 doesn't apply,
needs Cas. Still open as of this writing; see `STATE.md`.

---

### 2026-08-09 (pre-repo) — Eight corrected assumptions, caught before they shipped

Recorded in `CONTEXT.md` §6 as "corrections worth not repeating": extras
don't need accrue-and-settle (they were already post-paid), pay-up-front
doesn't deter flaking (refund-if-in-time is incentive-identical — what it
actually buys is collection certainty), no birth date needed (age is
self-reported either way), level shouldn't be admin-gated (self-reported
with passive flags is the accepted trade-off), don't rank slots by available
capacity (the list would shift under a reading player), notify per
transition not per spot, exactly one page is cacheable (the public
schedule, and only above the fill numbers), and don't defer goalie/coach
data to simplify v1 (build position-awareness from the start).

**Why recorded:** each was a confident wrong answer caught by checking
against how the league actually operates (`CONTEXT.md` §2–§3) rather than
against what seemed obviously right. The meta-lesson is referenced again
below, because it repeated at the architecture layer days later.

---

### 2026-08-09, `53b4dbf` — Initial architecture: self-hosted, rejecting Supabase and Vercel

The repository was first scaffolded on a self-hosted design: a Hetzner CX33
box, Docker Compose, Caddy, pg-boss as a worker process, hand-rolled auth,
`LISTEN`/`NOTIFY` over SSE, pgBackRest with WAL archiving, self-hosted
GlitchTip, React Router v8 as the web framework.

**Rationale at the time:** two earlier attempts on Supabase + Vercel had
produced a long bug list (PostgREST's 1,000-row cap, silent join failures,
`users.id` diverging from the Supabase auth UID, Realtime failing under RLS,
Vercel stripping headers from `pg_net`, build-cache staleness, cron jobs
split across two systems). That list was read as an indictment of the
platform itself.

**This diagnosis was wrong** — see the reversal below, one day later.

---

### 2026-08-10, `3db8b7d` and `d3e240f` — Reversal: back to Supabase and Vercel

Two commits, same afternoon, one decision: `3db8b7d` ported the web app from
React Router to Next.js App Router; `d3e240f` rewired the project onto real
Supabase and Vercel infrastructure and rewrote `ARCHITECTURE.md` to match.

**Why the reversal, honestly:** re-read item by item, the original bug list
didn't implicate the platform — it implicated two specific things inside it.
**PostgREST** caused the row cap, the silent join failures, and the UID
mismatch (all consequences of an auto-generated REST layer instead of a real
query builder talking to Postgres directly). **RLS** caused the Realtime
authorization failure and the general cost of debugging policies for logic a
server-side check would express directly. The `pg_net` header-stripping and
build-cache items were real but narrower and didn't require leaving the
platform either. Dropping PostgREST and RLS — Drizzle over a direct
connection, no RLS on application data, server-side authorization checks
everywhere — fixed the actual bug list. Dropping the platform too, and
taking on a box, a reverse proxy, backups and a job queue personally as a
solo developer on a deadline, was over-engineering dressed up as risk
reduction. Full accounting: `ARCHITECTURE.md` → "Why this stack, in one
page" and §14; `CONTEXT.md` §5.

**Why Next.js specifically, as part of the same move:** Supabase's own
documentation, quickstarts and `@supabase/ssr` guidance are Next-first, and
this project is built by a solo developer working through an agent — the
volume and currency of available documentation matters more here than which
framework is the theoretically better fit. See `ARCHITECTURE.md` → "Why
Next.js". SvelteKit and Rails were both seriously considered and rejected
for the same reason they're rejected today: no shared TypeScript core with
the planned Expo client (`ARCHITECTURE.md` §14).

**The meta-lesson, stated in `CONTEXT.md` §5 and worth repeating here
because it's the second time it happened in two days:** "the platform caused
our bugs" and "PostgREST and RLS caused our bugs" are different claims, and
only the second was true. Check a proposal against what actually happened
before generalising from it.

---

### 2026-08-10, `d3e240f` and after — Everything else the self-hosted plan is rejected in favour of

Consolidated in `ARCHITECTURE.md` §14 ("Rejected, with reasons") rather than
restated here: Hetzner/owned infrastructure → Vercel; Docker Compose + Caddy
→ Vercel; pgBackRest + WAL archiving → Supabase Pro's daily backups (PITR as
a separate add-on decision, still open, see `STATE.md`); pg-boss/a worker
process → Vercel Cron + an outbox table; hand-rolled auth → Supabase Auth
behind the existing `credentials` table; `LISTEN`/`NOTIFY` over SSE →
Supabase Realtime broadcast from a trigger on a public channel;
`postgres_changes` → broadcast (single-threaded, re-authorizes per
subscriber, Supabase's own guidance is to avoid it); private/RLS-gated
Realtime channels → public channel (fill counts aren't secret, so nothing
needs guarding); Vercel Edge Runtime for anything touching the database →
Node.js serverless runtime only (Edge can't hold a raw TCP connection);
`pg_net` → Vercel Cron calling a route handler directly.

---

### 2026-08-10, `051d75b` — `uuidv7()` compatibility shim

`ARCHITECTURE.md` §5's primary-key convention (`uuid primary key default
uuidv7()`) assumed Postgres 18. The real Supabase project is Postgres 17.6,
confirmed directly rather than assumed from Supabase's general docs, which
has no native `uuidv7()`. Rather than gate the schema on Supabase's Postgres
18 timeline, added a pure-SQL, RFC 9562 §5.7-compliant shim
(`packages/db/migrations/0000_uuidv7_shim.sql`) that self-disables once a
real `uuidv7()` exists. Verified with 5,000 generated values against both a
real Postgres 17 container and Postgres 18's native builtin. See
`ARCHITECTURE.md` §5 and §2.

---

### 2026-08-10, `c5a5d57` — Separate `.env.local` / `.env.production`, with a host guard

A single shared `.env` once let a local-only command resolve straight
through to the real Supabase database — nothing technical stopped it, only
the assumption that "the db scripts are for local dev" held, and that broke
the first time `.env` held real credentials for a verification task. Fixed
with two never-committed files plus `packages/db/guard-host.ts`, which
refuses to run a local-only script against a non-local host and vice versa,
independent of which file supplied the connection string. See `CLAUDE.md` →
"Environment files" for the full mechanism.

---

### 2026-08-10, `33cbbcd` — Vercel/Supabase integration env var names; homepage forced dynamic

Two related fixes in one commit. First: the Supabase–Vercel integration
injects `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`, not this repo's
`DATABASE_URL` / `DIRECT_URL` convention, and does not honor a manual rename
in the Vercel dashboard — it resyncs and overwrites one. `packages/db/env.ts`
now falls back to the integration's names. Second: the homepage was at risk
of Next statically prerendering `/` at build time, which would bake in
stale fill counts — the exact "site says a slot is open, form says it's
locked" bug this project exists to fix, reproduced in a new location. Fixed
with `export const dynamic = "force-dynamic"`. See `ARCHITECTURE.md` §8 ("The
one cacheable page, and the rule that protects it") and §10.

**Consequence still open:** the same static-prerendering risk applies to
`/register`, `/schedule` and `/admin` the moment any of them reads the
database instead of fake data — none of them force dynamic rendering today
because none of them need to yet. See `CLAUDE.md`'s warning on this.

---

### 2026-08-10 — `ice_sessions` seeded on Supabase; RLS-enabled-with-no-policies documented as deliberate

Supabase had 0 `ice_sessions` rows against local Docker's 220 — the deployed
homepage had no upcoming session to read fill from. Added a `seed:prod`
script (`packages/db/package.json`, `package.json`), mirroring `migrate:prod`
exactly: `SUMMERICE_ENV=production`, gated by `guard-host.ts
remote-required`, no bypass. Ran it against the real project; confirmed 220
`ice_sessions` / 6 `levels` / 10 `slots` / 20 `slot_capacities` / 14
`slot_levels`; ran it a second time and confirmed the counts didn't move,
proving the `ON CONFLICT DO NOTHING` idempotency `seed.ts` was already
written for actually holds against Supabase, not just local Docker.
`getSlotFillOverview` run directly against Supabase afterward returns all 10
slots with a correct next-upcoming session. See `STATE.md` for the current
per-environment table.

Separately, formalized something that was already true but only noted in
passing: every Supabase table has RLS enabled with zero policies (a platform
default, not something this codebase configured), which is harmless today
because Drizzle connects as the `postgres` role and RLS doesn't apply to a
table's owner. Added to `ARCHITECTURE.md` §5 as an explicit statement that
RLS is deliberately not the authorization model here, plus a forward-looking
warning: once Supabase Auth ships, a browser client querying a table
directly with a user's JWT hits RLS for real, and "enabled, no policies"
means it is denied everything, silently — a state that will present as an
application bug, not an RLS error. That moment needs a deliberate choice
(write real policies, or keep browser clients off direct table access
entirely) rather than a debugging session that rediscovers this paragraph
the hard way.

---

### 2026-08-10 — Live fill diagnosed end-to-end: mechanism was correct, not observable

Reported symptom: an UPDATE to `slot_capacities` on the deployed site produces
rows in `realtime.messages` and the browser opens a WebSocket, but the
homepage numbers never change. The working theory going in was a
topic/event/private mismatch between the trigger
(`0005_live_fill_broadcast.sql`) and the client (`use-live-fill.ts`).

Directly compared both sides instead of guessing:

- Queried `realtime.messages` on the live project: `topic =
  'slot-fill:<slots.id>'`, `event = 'fill'`, `private = false`.
- Read the trigger: constructs the same topic from `slots.id` (via
  `registrations.slot_id` / `slot_capacities.slot_id`, both FK'd to
  `slots.id`), same event name, `realtime.send(..., false)`.
- Read the client: subscribes to `slot-fill:${slotId}` where `slotId` is
  `getSlotFillOverview`'s `slot_id` — also `slots.id`, not
  `slot_capacities.id` — listens for `"fill"`, passes `{ config: { private:
  false } }`.
- All three — topic, event, private — matched exactly. No mismatch found.

Also checked, since both are real ways this exact symptom happens on this
project per `CLAUDE.md`: the live Vercel deployment (`dpl_4ATT2rXBJXbqGucPZ8nbyANz8fRV`,
READY) was built from `508648c`, the actual current `origin/main` HEAD — not
stale. And RLS-enabled-with-no-policies (see above) doesn't apply here either:
that only gates *private* channels; this one is deliberately public.

Since code comparison found nothing, verified the mechanism empirically
instead of continuing to read code: a standalone Node script using the same
`@supabase/supabase-js` client, same URL/publishable key, same topic
construction, subscribed and reached `SUBSCRIBED`; a real `UPDATE` on
`slot_capacities` (via the Supabase MCP `execute_sql` tool) then arrived at
that script as a `broadcast`/`fill` message within seconds. The full pipeline
— trigger → `realtime.send` → `realtime.messages` → logical replication →
Phoenix channel broadcast → `supabase-js` client callback — works exactly as
designed.

**Conclusion: there was no code bug to fix.** What was genuinely missing was
observability — nothing in `use-live-fill.ts` logged subscribe status or
message arrival, so "working but never watched" and "silently broken" were
indistinguishable from the browser. Added unconditional (not
`NODE_ENV`-gated — this needs to work from the deployed site, not just local
dev) `console.debug` calls on subscription status and every message
received. This does not change behaviour for end users, who don't have
devtools open; it exists so the next time this symptom is reported, the
console immediately shows whether a message ever arrived, rather than
requiring another live database diff to find out.

**Still not verified:** an actual browser has still never watched `/`
update live. The diagnosis is as far as it can go without one — see
`STATE.md`'s "Verified" section for exactly what confirming this requires.

---

### 2026-08-10 — Live fill, browser-verified: the prompt's premise didn't hold

A follow-up session was asked to debug "the live-fill failure on the deployed
site using browser automation," with three named failure branches to
diagnose. **The premise was wrong — there is no failure.** Per the session
ritual, that gets reported rather than worked around; recorded here so the
next session doesn't re-open this.

No browser-automation MCP tool was available. Installed Playwright
(`npm install playwright` into a scratch dir) and drove real headless
Chromium against `https://summer-ice-kappa.vercel.app/` (the correct/current
Vercel project — confirmed by matching `githubCommitSha` on its latest
`READY` production deployment against local `origin/main` HEAD, `e778956`;
a second, unrelated Vercel project in the same team, `summer-ice-2`, is a
stale fork with a different GitHub repo ID and was not the target).
Chromium's headless shell needed `libnspr4`/`libnss3`/`libasound2` that
weren't on the box and there was no root — worked around with `apt-get
download` (fetches a `.deb` without installing) + `dpkg-deb -x` into a local
dir + `LD_LIBRARY_PATH`, no sudo required.

With devtools-equivalent capture running (console, `pageerror`, failed
requests, 4xx/5xx responses, and raw WebSocket frames) and the page open on
`/`:

1. **All 10 `[live-fill] slot-fill:<uuid> subscription status: SUBSCRIBED`
   lines appeared** within ~1s of load — one per visible slot.
2. Updated `slot_capacities` (skater row for the Tuesday 5th/6th Division
   slot, `capacity` 20 → 18 — 18 chosen over the originally-suggested 12
   specifically because `ideal_capacity` is 16 there and the check
   constraint requires `ideal <= capacity`) via the Supabase MCP directly
   against the row already on screen.
3. **A `[live-fill] message on slot-fill:<uuid>: {...}` line appeared ~22s
   later**, correctly scoped to that one slot's topic.
4. **The rendered DOM updated with no refresh**: the page's text snapshot,
   taken after the change and after the watch window closed, reads `0/18
   skaters` for that slot — everything else on the page is still the
   as-seeded `20`/`10` capacities. Confirms this is not the "stale value
   reasserted on next render" bug this hook has had before.
5. No console errors, no `pageerror`s, no failed requests other than one
   unrelated aborted RSC prefetch for `/admin/session/wed-2130` (ordinary
   Next.js prefetch-cancel-on-navigate noise, not a live-fill symptom). No
   CSP violations — confirmed there's no `Content-Security-Policy` response
   header on the deployed page at all, so there was never anything to
   violate. The WebSocket to `wss://mmvbjdjwvclfaccgevji.supabase.co/realtime/v1/websocket`
   opened and stayed open the whole session.

The `slot_capacities` row was set back to `20` afterward — the mutation was
diagnostic only, not a real registration event, and leaving it at 18 would
have made `STATE.md`'s seeded-schedule description wrong.

**Conclusion: the full pipeline — trigger → broadcast → WebSocket → React
state → DOM — works, unmodified, in a real deployed browser.** This closes
the one gap the previous entry above left open ("an actual browser has
still never watched `/` update live"). No code change was needed or made
this session; the fix that mattered (subscribe/message logging) already
landed in the previous session. If this symptom is reported again, it is
very unlikely to be this mechanism — look at what's different about the
report (which slot, which browser, logged in vs not, timing) before
re-deriving the pipeline from scratch.

---

### 2026-08-10 — Concurrency core, phase 1: hold, confirm, release, promote for season registration

Build order phase 3 (`ARCHITECTURE.md` §13), started. Scope deliberately
bounded to what the load-test gate (§12) actually exercises — season
registration against `registrations` and `slot_capacities` — not the extras
`claims` path (phase 11) and not accepting/declining a waitlist offer
(neither is needed to prove the lock holds under concurrent carts).

**What shipped**, all in `packages/core`:

- `capacity-lock.ts` — `lockSlotCapacities`, one statement locking every
  `(slot, position)` a caller touches via `ORDER BY ... FOR UPDATE`, which
  *is* the ascending-lock-order guarantee (`ARCHITECTURE.md` §4.3), not
  just a display concern; `countActiveRegistrations`, the same live-fill
  formula as `slot-fill.ts`, callable only after the lock is held.
- `registration.ts` — `holdCart` (the mixed-cart function, DOMAIN-MODEL §4:
  never fails on a full slot, waitlists instead), `confirmCart` (webhook-
  driven, idempotent on cart status), `releaseRegistration` (withdraws,
  deliberately doesn't auto-promote — composability is the caller's job).
- `waitlist.ts` — `promoteWaitlist`, earliest-waitlisted → `offered`.

**Decision: result shape is a discriminated union, not exceptions, for
every expected domain outcome** (`held`/`waitlisted`/`already_registered`,
`confirmed`/`already_confirmed`/`cart_expired`, `no_capacity`/`empty_queue`,
etc.). Only genuine invariant violations (a missing `slot_capacities` row, a
missing `INSERT ... RETURNING` row) throw. Not written down anywhere before
this session; recording it here so a later function in this package doesn't
invent a different convention.

**Decision: `seasons.offer_window_minutes`, default 60, admin-configurable**
(migration `0006_season_offer_window.sql`). `DOMAIN-MODEL.md` §4 specifies
*that* a waitlist offer has an expiry but never how long — unlike the fixed
10-minute hold window (§7), which the domain model does state. Asked the
human directly rather than picking a number silently; answer was "1 hour
for now, but configurable in the admin dashboard," which is why it's a
per-season column rather than a `packages/core` constant, even though no
admin UI reads or writes it yet.

**Decision, scoped out on purpose: accepting/declining a waitlist offer.**
`DOMAIN-MODEL.md` §4's "Waitlist promotion" describes what happens after
`promoteWaitlist` — a one-line cart on accept, "swap on acceptance," and a
decline/expiry path whose resulting persisted status is ambiguous from the
docs as written (the state-machine diagram's `declined`/`offer_expired`
arrows both loop back toward `waitlisted`, but whether that means the same
row re-queues, and at what `waitlist_joined_at`, isn't stated). Building
that now would mean inventing fairness-affecting behavior with real money
attached, not implementing a spec. Left for a session where a human
resolves it or the domain model is amended to say.

**Found and fixed in passing:** the root `tsconfig.json`'s `include` glob
(`packages/*/*.ts`) was only one directory level deep, so `packages/*/test/**`
files were never reachable by `tsc --noEmit` as root files, and — since
nothing else imports test files — never pulled in via the import graph
either. `npx tsc --noEmit` had been silently not checking any test file in
the repo (there were none until this session, which is how this went
unnoticed). Changed to `packages/*/**/*.ts`, which also fixed the same gap
for ESLint's `parserOptions.project` (it points at the same root
`tsconfig.json`). Genuinely no test files existed before this session, so
nothing was actually going unchecked in practice — but the gap itself
predates this session and would have bitten the first `packages/db/test/`
or `packages/contracts/test/` directory silently.

**Verified:** 11 integration tests (`packages/core/test/*.test.ts`) against
real local Postgres via `node:test`, no mocks — mixed carts, waitlisting,
queue-position ordering, duplicate-registration prevention, idempotent
confirmation, release freeing a spot for the next holder, and promotion
picking the earliest queued registration. Plus one real-concurrency test
(8 independent transactions/connections racing a 1-capacity slot via
`Promise.all`, not a single rolled-back transaction) proving the row lock
serializes actual concurrent connections, not just sequential calls sharing
one transaction — a fast sanity check, not the load-test gate itself.
`npx tsc --noEmit` and `pnpm lint:all` both clean project-wide.

**Not done yet, and next:** the load-test harness itself — several hundred
concurrent multi-line carts with overlapping slot sets against a
20-capacity slot, asserting exactly 20 winners, no partial baskets, no
deadlocks (`ARCHITECTURE.md` §12). That's the actual phase-3 gate; today's
work is the mechanism it exercises, not the harness that proves it at
scale.

---

### 2026-08-10 — Waitlist decline/expiry resolved: `declineOffer`, and expiry folded into `promoteWaitlist`

Follow-up to the entry directly above, closing the one thing scoped out on
purpose: what actually happens when a waitlist offer is declined or
lapses. Asked directly rather than left open: **"if a waitlist spot is
declined/expires, it moves to the next person in the waitlist. How you
achieve that I leave to you."** Full reasoning in `DOMAIN-MODEL.md` §4;
summary here.

**Decision: decline calls promotion itself, in the same transaction —
deliberately inconsistent with `releaseRegistration`'s composability
stance.** `releaseRegistration` leaves promotion to the caller because
withdrawal has many call sites and reasons, not all of which want instant
promotion. A decline has exactly one purpose — hand the spot to whoever's
next — so `declineOffer` calls `promoteWaitlist` internally rather than
trusting every future caller to remember to chain the two. Recording the
inconsistency explicitly so it doesn't read as an oversight later.

**Decision: the decliner re-queues at a *fresh* `waitlist_joined_at`, not
the original.** DOMAIN-MODEL's diagram didn't specify this, but keeping
the original timestamp is a live loop bug, not just a fairness question:
if that person is the only one waiting, they'd float straight back to the
front the next time capacity opens, decline again, forever. Fresh
timestamp sends them to the back, same as anyone rejoining a real queue.

**Decision: no Cron sweep for expiry — folded into `promoteWaitlist`
instead.** There's no outbox/Cron infrastructure yet (`STATE.md`), and
correctness never depended on prompt sweeping anyway (`ARCHITECTURE.md`
§4.2 — a lapsed offer already doesn't count as "taken," regardless of its
stored status). So `promoteWaitlist` sweeps any lapsed `offered` row for
the (slot, position) it's about to act on back to `waitlisted` — bookkeeping
that happens for free wherever `promoteWaitlist` next runs for that key,
whether that's a decline, an admin action, or eventually a real Cron job.

**Bug caught by the new tests, not by review:** the sweep's first version
set the re-queued row's `waitlist_joined_at` using SQL `now()`. Every other
timestamp in `waitlist.ts` and `registration.ts` comes from JS
`Date.now()`. Inside one long-running transaction, SQL `now()` is pinned to
the transaction's *start* time — earlier than a `Date.now()` value written
moments later within that same transaction — so a swept row could
out-rank someone who'd genuinely been waiting longer, resurrecting exactly
the "front of the queue forever" bug the fresh-timestamp decision above was
supposed to prevent. The "sweeps a lapsed offer" test failed on the first
run with the wrong registration promoted, not a crash — caught because the
test asserted *which* person got promoted, not just that promotion
happened. Fixed by sourcing the sweep's timestamp from `new Date()` like
everywhere else in the module; the WHERE clause's own `now()` (a threshold
check, "has this deadline passed," never compared against a JS-sourced
value) was correct as originally written and didn't change.

**Verified:** 3 new integration tests (14 total in `packages/core/test/`),
covering decline-promotes-next-person, decline-on-a-non-offered-row, and
the lapsed-offer sweep. `npx tsc --noEmit` and `pnpm lint:all` clean.

**Still open:** accepting an offer (creating the one-line cart per
DOMAIN-MODEL §4's "swap on acceptance" and payment-reuse design) — a
payment-flow function belonging with `holdCart`/`confirmCart`, not built
this session.

---

### 2026-08-10 — Decline correction, route layer, and the phase-3 load-test gate, in one session

Three instructions in one message: build the route layer, fix decline
(again), build the load-test harness. Recorded together because the
middle one changed what the first and third needed to be right about.

**Correction: declining removes you from the waitlist — it does not
re-add you.** The entry directly above this one shipped `declineOffer`
re-queuing the decliner at the back of the waitlist. Direct correction,
same day: *"declining removes you from the queue, it shouldn't re-add the
person. That's not logical."* It wasn't a design decision that got
overridden — re-reading the source, it was this codebase's own
misreading of DOMAIN-MODEL §4's diagram, which shows the transition
looping back toward the waitlist box without ever actually specifying
that as the resulting *persisted* status. Fixed by reusing
`releaseRegistration`'s `offered` → `withdrawn` transition instead of a
second hand-rolled one; `promoteWaitlist`'s lapsed-offer sweep got the
same fix by inference (not a second direct instruction — flagged as such
in `DOMAIN-MODEL.md` §4 in case that inference is wrong), on the
reasoning that this codebase already treats non-response as a real,
binding choice elsewhere (§5, "unknown is out") rather than a softer case
than an explicit decline. `registrations.ts`'s schema comment and
`DOMAIN-MODEL.md`'s diagram were both wrong in the same direction and
both corrected.

**The route layer: `apps/web/app/api/registrations/**`, three routes
(hold, release, decline), no `confirm` route.** Thin callers per
`ARCHITECTURE.md` §4.1 — parse, call `packages/core`, serialise. Request
validation lives in `packages/contracts/registration.ts` (Zod), the
package's first real content. **No confirm route, on purpose**:
`ARCHITECTURE.md` §4.5 restricts confirmation to the Mollie webhook, which
doesn't exist yet (phase 5) — exposing it as a plain route now would let
anyone confirm a registration without paying for it. **Flagged loudly, not
silently accepted: these three routes trust a body-supplied `personId`
with zero session verification**, because Supabase Auth doesn't exist yet
(phase 4, not phase 6, which is where registration UI was originally
scheduled) — building this ahead of auth was the direct instruction, and
the gap is real, not hypothetical, so it's called out in the route files
themselves, in `STATE.md`'s package table, and in `STATE.md`'s "not
verified" list, all three, on the theory that a gap this consequential
should be hard to miss by only reading one of them.

**Driving the routes surfaced a real, if minor, hygiene bug**, independent
of the decline correction: `releaseRegistration` set `status: "withdrawn"`
but left `hold_expires_at`/`offer_expires_at` untouched, so a withdrawn
row could carry a stale future-looking timestamp forever. Harmless for the
availability formula (status alone gates it), confusing for anyone
reading the row directly. Fixed to null both on withdrawal.

**The load-test harness — `packages/core/load-test/season-registration.ts`,
run and passing twice.** `ARCHITECTURE.md` §12's actual phase-3 gate: 300
concurrent multi-line carts, a 20-capacity hot slot plus a shared 4-slot
cold pool for genuine overlapping contention, fired via
`Promise.allSettled`. Needed a new `dbDirectPooled(max)` export in
`packages/db/client.ts` — `dbDirect()`'s postgres-js default of 10
connections would have throttled "several hundred concurrent" down to
10-at-a-time, a materially weaker test than ARCHITECTURE actually calls
for.

**Two bugs the harness caught in itself, before it caught anything in the
product — worth recording because both would have produced a
false-positive PASS, not a crash:**

1. **Connection-pool sizing.** First run at `POOL_MAX = 50` failed 230 of
   300 calls with `"sorry, too many clients already"` — local Postgres's
   `max_connections` is 100, and a running `next dev` server plus a couple
   of `psql` sessions were enough to tip 50 over the edge. Not a
   correctness failure in the product, but the harness correctly refused
   to call it a pass — `held` still equalled exactly 20 even under this
   failure, which on a less careful read could have looked like success.
   Settled on `POOL_MAX = 30`, comfortably under the ceiling.
2. **An indexing bug in the harness's own assertions.** The "no partial
   baskets" check zipped `Promise.allSettled`'s *filtered* fulfilled
   results against the *original, unfiltered* `carts` array by position —
   correct only when nothing was rejected. Once the connection-pool
   failure above produced 230 rejections, the filtered array's indices no
   longer lined up with `carts`, and the check reported 13 false "partial
   basket" failures that had nothing to do with partial baskets. Fixed by
   zipping against the original index from `settled.forEach`, before any
   filtering.

**Verified, both runs:** exactly 20 held, exactly 280 waitlisted, 0
rejected calls, 0 partial baskets, 0 duplicate active registrations,
database counts agreeing with the calls' own reports. `npx tsc --noEmit`
and `pnpm lint:all` clean throughout. The three routes driven end-to-end
with `curl` against a running dev server and hand-inserted fixtures,
cleaned up afterward — see `STATE.md` for the exact sequence.

**Build order phase 3 (`ARCHITECTURE.md` §12–13) is done as of this
entry.** Phase 4 (auth) is next, not optional — it's what closes the
security gap this session's route layer opened on purpose.

---

### 2026-08-10 — Phase 4, first slice: Supabase Auth, session handling, and closing the registration routes' security gap

"Start there" — phase 4 (`ARCHITECTURE.md` §7), previously "decided, not
implemented." First slice, not the whole phase: password auth end to end,
session handling, `credentials`/`roles` provisioning and lookup, and —
the actual point — the three season-registration routes (previous
session) rewired to real identity, closing the gap they were built with
on purpose.

**Verified `@supabase/ssr` guidance at implementation time rather than
from memory, per §7's own warning that this SDK moves fast.** Fetched
Supabase's own docs via MCP `search_docs` (139KB of current material,
digested via a subagent to keep it out of main context) and cross-checked
the more surprising finding — Next.js renamed `middleware.ts` to
`proxy.ts` in v16.0.0 — directly against this repo's installed `next`
package (`node_modules/next/dist/docs/.../proxy.md`), not just a search
result, since a naming-convention claim that consequential deserved a
primary source. Both confirmed current: `createServerClient`/
`createBrowserClient` use `getAll`/`setAll` cookies now (not the older
three-method `get`/`set`/`remove` pattern still floating around in older
tutorials), and `getClaims()` — not `getSession()`, not even `getUser()`
— is Supabase's current recommended call for protecting pages/routes
(`getSession()` never re-validates; `getUser()` is for when you need a
fresh server-confirmed record, not for the yes/no check itself).

**Correction to `ARCHITECTURE.md` §7's own prose:** it said a credentials
row gets `provider = 'supabase'`. The schema's actual four-value enum
(`password`/`google`/`apple`/`email_link`) is more specific and is what's
actually used — `'supabase'` isn't a value the check constraint even
allows. Loose phrasing in an implementation-design paragraph, not a real
disagreement between the doc and the schema; corrected in place.

**Found and documented, not fixed: `sessions` (DOMAIN-MODEL §2) is a
self-hosted-plan relic nothing uses.** It's a hand-rolled `token_hash`/
`revoked_at` session table, designed for the plan this repo moved away
from before Supabase Auth was chosen — §7 already said to use Supabase
Auth's own refresh-token flow "rather than reimplementing it," it just
never revisited the table that reimplementation would have been. Supabase
Auth's own JWT/cookie session (via `@supabase/ssr`) is what phase 4
actually uses; `sessions` is migrated, empty, and unread by anything built
this session. Left in the schema rather than dropped — dropping a
migrated table is a bigger, separate decision than building auth is —
but flagged in both `DOMAIN-MODEL.md` and `ARCHITECTURE.md` so a future
session doesn't wire it in out of habit.

**Design calls made without a second direct instruction, each with
reasoning recorded inline where the decision lives:**

- `getCurrentPerson()`/`requireOwnerOrRole()` (`apps/web/app/lib/auth.ts`)
  compose a validated Supabase session with a domain-side `people` lookup
  (`packages/core/identity.ts`) — split so `apps/mobile` can reuse the
  domain half unchanged later, matching how every other domain concern in
  this repo is split from its web-layer caller.
- `ensurePersonForAuthUser` provisions inside `signUp()`'s own action
  (using `data.user.id`, populated immediately regardless of whether email
  confirmation is pending) rather than waiting for an active session —
  confirmed necessary, not just theoretical caution: this project's real
  Supabase Auth settings do require confirmation (verified directly, see
  below), so a session-gated provisioning path would never have fired for
  a real signup.
- `proxy.ts` refreshes the session cookie only — no redirect-based route
  gating. Nothing in `apps/web` is role-gated yet (every page is still
  fake-data), and Next's own data-security guide and `proxy.md`'s own
  warning are explicit that a proxy/page-level check never extends to a
  nested Server Action or route handler regardless — so gating there now
  would be dead weight, not defense in depth, until there's an actual
  protected route tree to redirect away from.
- The registration routes' ownership check (`requireOwnerOrRole`, release
  and decline) is a plain `SELECT` on the target registration's
  `person_id` before calling `packages/core` — judged as HTTP-layer
  authorization plumbing, not the capacity/money/state-transition domain
  logic `.claude/rules/web-routes.md` reserves for `packages/core`.

**Verified, not just written:**

- 4 new integration tests (`packages/core/test/identity.test.ts`, 18
  total in `packages/core`), real local Postgres, no mocks:
  `ensurePersonForAuthUser` provisions on first call and is idempotent on
  a second call for the same subject; `getPersonForAuthSubject` returns
  null for an unlinked subject; `getPersonRoles`/`personHasRole` reflect
  a real `roles` row.
- The actual security fix, through the real request pipeline: `curl`
  against `POST /api/registrations` with no session cookie now returns
  `401`, where it previously succeeded. Same against `/release` and
  `/decline` with a **real** registration id (so the check reaches the
  ownership branch, not just short-circuits on "not found") — also `401`.
- Supabase Auth itself, live: a direct `supabase.auth.signUp()` call
  against the real project succeeded and revealed a real, useful fact —
  this project requires email confirmation (`session: null` on signup) —
  confirming the signup action's two-branch design (redirect home vs.
  redirect to check-your-email) isn't hypothetical. `@example.com`
  addresses are rejected by Supabase's own email validation
  (`email_address_invalid`) — worth knowing before reaching for that
  domain in a future test. Test user deleted from `auth.users` afterward
  via the Supabase MCP; no orphaned test data left in either database.

**Not verified, and said so rather than implied otherwise:** an actual
browser submitting the signup/login forms and landing on a real session.
Next's Server Actions use React's RSC action-reference wire protocol, not
a plain form POST — the same `curl`-based approach that worked for last
session's plain `app/api/*` routes doesn't reach a `'use server'` action.
No browser-automation tool (Playwright/Chromium) was available this
session, and the previous session's headless-Chromium setup (`apt-get
download` + `dpkg-deb -x`, no root) didn't persist into this one. Recorded
as a real, named gap in `STATE.md` rather than papered over with the
adjacent things that *were* verified (the Supabase call, the DB logic,
the pages rendering) standing in for it.

**Scoped out on purpose, not forgotten:** Google/Apple OAuth (needs
external provider console setup this session can't do unattended),
dependent promotion and guardian-acts-for-dependent authorization,
multi-provider identity merging, and wiring the real `/register` UI to
the now-working `holdCart` route — everything up to and including this
session still only reaches `packages/core` via `curl` and tests, not a
person clicking through the actual site.

### 2026-08-10 — Homepage restyled from the "Summer Ice Landing" Claude Design project

Imported and implemented `Summer Ice Landing.dc.html` (Claude Design
project `95d5c2c4-e2a2-48d5-9b54-084e81223b27`) as the new `/` — a
marketing-grade nav/hero/schedule/footer page, replacing the plain
bullet-list homepage. Purely presentational: the page still reads real
data the same way it did before (`dbPooled()` → `getSlotFillOverview()`
→ `force-dynamic`, unchanged, still satisfies `ARCHITECTURE.md` §8), and
the live-fill subscription (`useLiveFill`) moved into a new
`landing-slot-row.tsx` rather than being dropped.

**Adapted rather than copied verbatim, in ways worth recording:**

- The design's `assets/logo-circle.png`, `colors_and_type.css`'s design
  tokens (OKLCH palette, shadows, radii) were pulled in; its self-hosted
  Inter `.ttf` and its `image-slot.js`/`support.js` (the Claude Design
  canvas's own preview runtime, not app code) were not — this repo
  already loads Inter via `next/font/google`.
- The design's per-instance customisation props (`heroLayout: split |
  stacked`, `showLiveCounts`) are a Design-canvas authoring convenience,
  not something a real page needs a prop for — implemented as one
  responsive layout (CSS Grid + media queries reflow hero/stat-band/
  schedule at ~720px) rather than porting the two-variant `sc-if` switch.
- The schedule table's mock "kind" subtitle (e.g. "Drills for skaters and
  goalies" under Skills Training) and the "Full · N waiting" queue count
  aren't backed by real fields `getSlotFillOverview` returns — dropped
  rather than fabricated. The stat band's four figures (`Tue–Sun`,
  `2nd–6th + rec`, season dates, `Five-on-five · No contact`) are static
  in the design's own source too (not template variables), so they stay
  static copy here rather than being parsed out of live data.
- Nav's "Sign in" and the season/register CTAs were pointed at this
  repo's real routes (`/login`, `/register`) instead of the design's `#`
  placeholders — those pages exist; only "Contact" and "Privacy" stay
  `#`, since nothing exists there yet either.
- Copy: the design's "How it works" step said "iDEAL or Wero." First
  changed to "One iDEAL payment" on the grounds that `DOMAIN-MODEL.md` §6
  only documents Mollie/iDEAL, with SEPA Direct Debit as an explicit
  phase-two item — nothing in the repo's own docs supports Wero. Reverted
  same session, per Michael directly: Wero is iDEAL's own succession path
  (Currence, iDEAL's operator, is part of the EPI/Wero coalition), and the
  copy is deliberately future-proofed rather than describing what's wired
  today. Kept as "One iDEAL or Wero payment." `DOMAIN-MODEL.md` §6 itself
  is unchanged — it still only documents Mollie/iDEAL as integrated — so
  this is landing-page copy running slightly ahead of the payments
  integration on purpose, not a claim that Wero is implemented.

**Site-wide side effect, not scoped to just this page:** dark mode was
previously pure `prefers-color-scheme`, no manual override anywhere. The
design's floating light/dark toggle needed one, so `globals.css` now
declares `@custom-variant dark (&:where(.dark, .dark *))`, switching
every `dark:` Tailwind utility in the whole app (not just the landing
page) from OS-preference-only to class-based with OS-preference as the
initial default. An inline script in `layout.tsx`'s `<head>` sets the
class before first paint (from `localStorage["si-theme"]`, falling back
to `matchMedia`) so there's no flash; `<html>` got
`suppressHydrationWarning` because that script deliberately mutates the
DOM out from under React before hydration runs — the standard, documented
shape of this exact tradeoff (the same one `next-themes` makes), not
something discovered by accident.

**Found only by actually driving a browser, not by curl or by reading the
diff:** the first version hydration-mismatched on every page load —
console error, not visible breakage — because the theme-init script's
DOM mutation on `<html>` disagreed with React's expected server-rendered
markup. `suppressHydrationWarning` above is the fix; it would not have
been discovered without the browser check below, since `curl` sees
identical server-rendered HTML either way and `tsc`/`eslint` have no
opinion on hydration.

**Verified, not just written:**

- `npx tsc --noEmit` (root) and `eslint` on every changed file: clean.
  One real `eslint` finding fixed along the way, not suppressed by
  reflex: `theme-toggle.tsx`'s effect-based `setState` is the correct
  shape for "avoid a hydration mismatch, then correct after mount," not
  the anti-pattern `react-hooks/set-state-in-effect` normally flags —
  kept, with a targeted `eslint-disable-next-line` and the reasoning
  inline, rather than restructured into something that would reintroduce
  the mismatch the effect exists to avoid.
- Server-rendered HTML, via `curl` against a running dev server reading
  the real (empty) local database: exactly 10 schedule rows in schedule
  order (`Tue, Wed, Wed, Thu, Thu, Fri, Fri, Sat, Sat, Sun`), the live
  count reading "10 of 10 slots still have room" (correct for an
  all-empty `registrations` table), 10 "Claim →" links and 0 "Join
  waitlist" links (also correct, since nothing is full), and `/register`
  still rendering the original plain `Nav` (confirming the new hide-on-
  `/` check in `nav.tsx` doesn't leak to other routes).
- **A real browser, not just curl** — no browser-automation MCP tool was
  available, so headless Chromium was made to run the same way a previous
  session's `DECISIONS.md` entry (2026-08-09/10, live-fill) recorded and
  this session confirmed still doesn't persist between sessions: `apt-get
  download` the missing shared libs (`libnspr4`, `libnss3`,
  `libatk-bridge2.0-0t64`, etc. — Ubuntu 24.04's `t64`-suffixed names)
  into a scratch directory, `dpkg-deb -x` each into a local prefix (no
  root needed for either step), `LD_LIBRARY_PATH` pointed at it, then
  Playwright's own Chromium launched normally. Screenshotted light mode,
  clicked the toggle and screenshotted dark mode (persisted via
  `localStorage`, confirmed still dark after navigating to `/register` in
  the same browser context), and a 420px-wide viewport to confirm the
  hero/stat-band/schedule-table media queries actually reflow instead of
  overflowing. `page.on("console"/"pageerror")` caught the hydration
  mismatch above; after the fix, zero console errors across all of it.

**Not verified:** the Realtime live-fill broadcast on this page
specifically — `landing-slot-row.tsx` reuses the same `useLiveFill` hook
already end-to-end proven (see the 2026-08-10 live-fill entries above)
verbatim, just restyled, so this is judged low-risk rather than
re-proven from scratch this session.

### 2026-08-10 — `logo-circle.png` shipped truncated: a real cap in the design-import tool, not a rendering fluke

Michael reported the logo "only 75% loading" after the session above
shipped. Root-caused rather than re-guessed: `DesignSync`'s `get_file`
caps binary reads at 256 KiB — undocumented in its own `truncated` field,
which stayed `false` on a file that was, provably, cut mid-stream. Walked
the PNG's chunk structure by hand: no `IEND` chunk, and the final `IDAT`
chunk's declared length ran 317+ bytes past the end of the file — not a
guess, a byte-for-byte confirmation of truncation. The original asset
(768×768) sat just over the cap; the 256 KiB figure survives as a base64
character count (262144 = 256 × 1024) that decodes to exactly the
on-disk byte count (196608) — the cap is on the wire encoding, not the
raw file.

**Why it didn't show up in this session's own browser-verification
pass:** this sandbox has no `sharp`, so `next/image`'s optimizer route
fell back to proxying the corrupt bytes unmodified rather than
re-encoding them — confirmed by requesting `/_next/image` at seven
different widths and getting the identical untouched 196608-byte file
back every time. A real build (Vercel's, or any environment with `sharp`
installed) actually decodes and re-encodes on the server, which is where
a truncated source stops being silently tolerated. Recorded as a gap in
the earlier "zero console errors" verification claim: that pass proved
hydration was clean, not that every asset was intact — a distinction
worth remembering the next time "the browser check passed" gets read as
"nothing is wrong."

**No path existed to fetch the rest of the bytes.** `get_file` has no
offset/range parameter; `ListMcpResourcesTool` against every connected
MCP server turned up no resource for the design project at all (it isn't
exposed as a standard MCP resource, just this bespoke tool); `.thumbnail`
in the project is a single whole-canvas preview, not a per-asset one.
Asked Michael directly rather than silently shipping a hand-redrawn
substitute for his brand mark — the options put to him were: attach the
real file, let me recreate it as SVG, or re-export a smaller original
from the design project. He attached the file directly.

**The attachment wasn't retrievable as inline pasted bytes** — no tool
here reads a pasted-image content block directly to disk. Found it
instead by searching the filesystem for image files newer than the
session's own recent output (`find ... -newer <a screenshot from minutes
earlier>`), which surfaced two candidates on the Windows side of this
WSL environment (`/mnt/c/Users/Michael/Downloads/`): one an exact
byte-for-byte match of the *already-truncated* 196608-byte file (almost
certainly a save-image-as of the broken version being served, not
useful), and `summericelogocircle1-300x300.png` (34682 bytes, newer,
differently named) — walked its chunk structure the same way as the
original truncation diagnosis, confirmed a clean `IEND` and the byte walk
landing exactly on the file's end, then used that one.

**Verified:** the replacement file is a real, complete PNG (chunk walk
terminates cleanly at `IEND`, matches the file length exactly) and
visually matches the logo Michael showed directly. Re-ran the same
browser/screenshot pass from the earlier entry (same headless-Chromium
setup, still live from this session) rather than assuming a same-shape
file swap was risk-free: zero console errors, and the screenshot shows
the real logo — not the placeholder-shaped-but-corrupt one — rendering
cleanly in the nav, hero and footer. The Wero-copy revert (previous
entry) was screenshotted in the same pass, confirming both changes
landed together correctly.

### 2026-08-10 — Re-import requested; caught it was a repeat, then re-synced against real design changes

Michael re-sent the original "import and implement `Summer Ice Landing.dc.html`"
instruction verbatim. Checked state first rather than redoing the work
blind, per `CLAUDE.md`'s session ritual: the design had already been
implemented and pushed (`c6369c6`, `5560170`), local `main` matched
`origin/main` exactly, and the current logo file was the good one Michael
supplied — re-running the original import would have re-fetched
`assets/logo-circle.png` through `DesignSync` and re-truncated it,
regressing the fix two entries above. Reported the contradiction instead
of complying silently; Michael confirmed the actual intent was that the
design project itself had changed and asked for a re-sync — re-fetching
`.dc.html`/`colors_and_type.css` (text, no truncation risk) but
deliberately *not* re-fetching the logo.

**Real changes in the current design, diffed against what was
implemented:**

- Top nav restructured: dropped "Schedule" and "The rink" as direct nav
  links; added "Home" as an active/underlined current-page indicator
  (`border-bottom: 2px solid var(--primary)`); "How it works" and "Sign
  in" remain, now alongside a multi-page site structure (`How It
  Works.dc.html`, `Login.dc.html`, `Register.dc.html`, `Contact.dc.html`,
  `Privacy.dc.html` all now exist as separate files in the design
  project). Not treated as a signal to split this page into multiple
  Next.js routes — this repo already has real `/login` and `/register`
  routes those links point to, and "How it works" still has real content
  in-page here (`#how`), so it stays an anchor rather than a link to a
  route that doesn't exist. Same reasoning as the first pass's Contact/
  Privacy decision, just re-applied to a design that's now further along.
- The floating bottom-right theme toggle is gone from the design
  entirely — moved into the footer's link row as a small (34px) bordered
  icon button, transparent background, `border-color`/`color` shifting to
  `var(--primary)` on hover. `theme-toggle.tsx`'s logic (the class toggle,
  the localStorage persistence, the effect-not-lazy-initializer hydration
  handling) is unchanged — only its container and CSS class changed, from
  a fixed Tailwind-utility button to `styles.themeToggle` in the CSS
  module, sized and positioned to match.
- Confirmed, not changed: "One iDEAL or Wero payment" is what the design
  source has said the whole time — re-fetching it just re-confirms the
  entry two above (Michael's correction, not a new design edit).

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean; re-ran the
same headless-Chromium pass — zero console errors, nav shows Home
(underlined)/How it works/Sign in/Register, footer shows the small
circular toggle in place of the old floating button, dark mode still
toggles correctly from its new location. (The full-page screenshot shows
the sticky nav appearing to "duplicate" partway down the page — a known
Playwright `fullPage` capture artifact for `position: sticky` elements,
not a real rendering bug; same class of thing as the floating-button
artifact noted in the very first browser-verification pass this
session.)

### 2026-08-10 — `/register` restyled from `Register.dc.html`, wave-1 logic kept and extended

Implemented the design project's `Register.dc.html` — the same "Summer
Ice Landing" project, focused this time on the register page instead of
`/`. Unlike the landing page, `/register` already had a real, working
wave-1 interactive component (`register-client.tsx`: position selection,
a basket with real holds/countdowns, waitlisting with queue position, a
"simulate another player" contention demo) — this was a restyle of an
existing feature, not a fresh implementation of a static mock.

**Deliberately did not copy the design's own JS model.** `Register.dc.html`'s
`RAW` seed array is static — adding a slot to its `picked` list never
changes any displayed number, so its `stale` row state (`inBasket && mine
=== 0`) is unreachable dead code in the mock; there's no interaction that
ever produces it. This repo's whole point is atomic claiming under real
contention (`CLAUDE.md`'s opening paragraph), so throwing that away to
match the mockup exactly would have deleted the one thing worth keeping.
Kept the existing fake-data-backed `available()`/hold/waitlist logic and
fit the design's row-state taxonomy on top of it instead:

- **Basket simplified from an array to one line per slot**
  (`Record<slotId, BasketLine>`), matching what the design's `picked:
  string[]` actually models (one entry per slot, not multiple positions
  held simultaneously on the same slot) — a real simplification of the
  prior model, not just a rename.
- **"Stale" made real, not decorative:** a held line goes stale when
  `takenByOthers(slot, position)` (season roster + the demo's simulated
  extra — explicitly *excluding* the line's own hold, otherwise every
  held line would trivially look stale the instant it's created) reaches
  capacity. Reachable in practice: hold a slot, then run the contention
  demo against it enough times, and the row now visibly flips to the
  design's red "stale" variant with a real "Remove" action — the
  literal race condition this app exists to make impossible once it's
  a real backend, demonstrated as a UI state while it's still fake-data.
- **Lapsed time-based holds are dropped from the basket at render time**
  (`liveBasket`, a `useMemo` filter over `basket` keyed on `now`), not
  mutated into state on every second's tick — expiry already means
  "gone," and a dropped row just recomputes back to whatever state its
  live availability implies (`plain`, `full`, etc.) rather than needing
  its own "expired" visual the design doesn't have anywhere to put.
- **Both "no spots left for my current position" and "no spots at all"
  keep working "Waitlist →" buttons** — the design leaves both
  undecorated (`<button>Waitlist →</button>`, no `onClick`, typical of a
  design-tool mock), but this repo's existing waitlist-with-queue-position
  feature was worth keeping functional rather than downgrading to
  decoration to match the mock precisely.
- **The design's itemized "Basket" section is gone entirely** — replaced,
  as the design intends, by row-level state in the schedule table itself
  plus the fixed sticky bottom bar (total, slot count, a one-line
  summary, the theme toggle, "Hold & continue →"). The old separate
  per-line countdown display went with it; the sticky bar's static "Held
  for 10 minutes while you pay" note is what the design actually shows
  here, not a per-row timer, so that's what shipped. "Continue" reuses
  the existing simulated pay-and-confirm behavior (`setPaid(true)`) —
  still fake, same as before.

**New shared component, not duplicated a second time:** `site-nav.tsx`
factors out the sticky nav both `/` and `/register` now use — same
brand/Home/How it works/Sign in, with the "Register" link the only thing
that changes shape: always a filled pill (a nav item and a CTA at once),
`--foreground` colored generally, switching to `--primary` when it's
also the current page's "you are here" marker. `ThemeToggle` gained a
`size` prop (34px in the landing footer, 38px in the register page's
sticky bar — each page's own spec, not reconciled to one size). The
global wave-1 `Nav` (`components/nav.tsx`) now also hides on
`/register`, alongside `/`, for the same stacked-nav reason as before.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean. Headless
Chromium, driven through actual interaction rather than just a static
screenshot: switched to "Both" (role chips appear on chosen rows,
per-row Skater/Goalie override works), added two slots (sticky bar
totals update correctly, row switches to the chosen/highlighted variant
with a working "Remove"), ran the contention demo against an
*unheld* slot until it filled (row live-transitions from open → blocked
"Full", demo button disables itself), then — separately — held Friday
21:30 first and ran the same demo against that *held* slot specifically:
confirmed the "stale" path is real, not just plausible-looking code —
the row visibly flipped to the red variant with "No skater spots left,"
the sticky bar's summary line changed to "One slot needs fixing before
you continue," and "Continue" disabled itself, exactly as designed.
Also toggled dark mode from the sticky bar's new 38px toggle, clicked
"Hold & continue →" through to the confirmed state (sticky bar
disappears, green confirmation banner appears, "Remove" buttons
disappear), and reflowed correctly at a 420px viewport. Zero console
errors throughout any of it. Also confirmed `/schedule` still renders
the original plain wave-1 `Nav` untouched, with dark mode correctly
carried over from the site-wide toggle.

**Not verified:** the row-state taxonomy's rarer combinations (e.g. a
stale line in "both" mode specifically, or the picker interacting with a
row that goes stale mid-pick) — the main paths above were driven for
real, not an exhaustive matrix of every state × every mode.

### 2026-08-10 — `/login` restyled from `Login.dc.html`; "Continue with Google" shipped disabled after testing it for real

Implemented `Login.dc.html`: a centered auth card (logo, Google button,
divider, email/password form, "no account yet" link) instead of the
plain wave-1 form, a floating bottom-right theme toggle (this page's own
revision never got moved to the small-inline style Landing/Register use —
implemented as its own `variant="floating"` on `ThemeToggle` rather than
forced to match), and a simple centered footer distinct from the
richer one on `/`. `SiteNav` gained a third `active="login"` state —
"Sign in" gets the same underlined-active treatment `active="home"`
gives "Home", not a filled pill the way "Register" is (that one's also a
CTA; this one's just a nav destination).

**Tried wiring "Continue with Google" for real, then reversed that after
testing it, not after reasoning about it.** The instinct was to reuse the
"iDEAL or Wero" precedent — call the real `signInWithOAuth`, let it fail
gracefully with whatever error Supabase returns for a disabled provider,
since Google isn't configured on the project yet (`STATE.md`'s "Not
built yet" list — needs Google Cloud Console setup no session here can
do unattended) and the call needs no code change once it is. Screenshot
evidence said otherwise: `signInWithOAuth` does a real top-level
`window.location` navigation to Supabase's authorize endpoint, not a
fetch this component's own `error` state can catch — even with
`skipBrowserRedirect: true`, the "is this provider enabled" check only
happens server-side once the browser actually requests that URL, so
`data.url` still comes back with no local error either way, and
navigating there (whether the library does it or this code does)
replaces the whole page with Supabase's raw `{"code":400,"error_code":
"validation_failed","msg":"Unsupported provider..."}`. That's a
broken-looking result, not a graceful future-proofed one — the
"future-proof it" instinct doesn't survive contact with how this
specific API actually fails. Shipped disabled instead, with a `title`
explaining why, wiring removed rather than left dead in an unreachable
branch — see `google-signin-button.tsx`'s own comment for the full
account, including that the raw-JSON screenshot is what caught it.

**Other adaptations:**

- "No account yet?" links to `/signup` (the real account-creation route,
  full name + email + password + position + age attestation), not a
  literal "Register for a slot" — the design's own copy conflates
  signing up with registering for ice time, but this app keeps them
  separate on purpose (`STATE.md`: "no signed-in registration flow
  exists yet, just the API layer + a bare signup/login form"), and
  `/register` doesn't create an account. Link text changed to "Create an
  account →" to match what it actually does, following the design's
  link *pattern* rather than its exact wording, the same as `Register:
  "Waitlist →"` buttons elsewhere in this project stayed real rather
  than decorative.
- "Forgot?" stays an unwired `href="#"`, same treatment as Contact/
  Privacy on the other pages — no password-reset flow exists yet, and
  omitting the link entirely would be a bigger, uninstructed departure
  from the design than leaving a placeholder.
- The real `login` server action (`actions.ts`, unchanged) is exercised
  through the new UI unmodified — restyled the form, not the auth logic,
  same split as the register page's restyle.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean (one real
finding along the way: `@typescript-eslint/no-misused-promises` on
passing an async handler straight to `onClick`, fixed with a wrapping
arrow rather than suppressed). Headless Chromium: light and dark mode
(floating toggle), a real bad-credentials submission against the actual
Supabase Auth project — server action genuinely round-tripped, "Invalid
login credentials" rendered in the new styled error state, not mocked —
confirmed the Google button is `disabled` via `isDisabled()` rather than
just visually styled to look it, a 420px mobile viewport, and confirmed
`/` still shows "Sign in" correctly *inactive* and "Register" in its
default (non-primary) color, i.e. the new `active="login"` nav state
didn't leak into other pages. Zero console errors.

### 2026-08-10 — `/contact` implemented from `Contact.dc.html`; two real corrections, one caught only by screenshotting

Implemented `Contact.dc.html`: header band, a two-column layout (message
form card + a sidebar of three cards — email, rink/map, a "before you
write" pointer to `/#how`), the login-style floating theme toggle, and
the landing-style rich footer. First page created from scratch this
design-import series rather than a restyle of something existing —
`/contact` didn't exist before (only `#` placeholder links pointed at
it).

**`SiteFooter` extracted, then immediately had to grow a flag.** Second
real use of the rich footer (landing's), so factored it out the same way
`SiteNav` was — but the first screenshot of the result showed *two*
theme toggles on `/contact`: the inline one `SiteFooter` inherited from
landing's current footer, stacked with the floating one this page also
needs (`Contact.dc.html`'s own footer has no toggle in it at all —
confirmed by re-reading its markup — it relies solely on the separate
floating button, the same as Login). `SiteFooter` gained a `themeToggle`
prop (default `true`, matching `/`; `/contact` passes `false`) rather
than either page compromising to match the other — the two source pages
genuinely disagree on where the toggle lives, so the shared component
needed to represent both, not average them. Caught by the screenshot,
not by reading the diff — the code looked correct in isolation.

**Two corrections to the design's own copy, not just its layout:**

- **`hello@summerice.club` → `hello@summerice.nl`.** `.club` is the
  self-hosted plan's now-gone staging subdomain (`ARCHITECTURE.md` §10:
  "`summerice.club` ... is gone along with the Compose staging stack it
  identified"), not this project's real domain — `ARCHITECTURE.md`'s own
  opening line says the application "takes over `summerice.nl`
  entirely." The design's static `mailto:` link was pointing at a
  address that belongs to an abandoned plan, not a stylistic choice
  worth preserving the way "iDEAL or Wero" was.
- **The contact form doesn't pretend to have a backend it doesn't
  have.** No outbox table, no `email.send` job, no route handler exists
  to receive a POST from this form (`STATE.md`: "No outbox table, no
  Cron endpoints, no notification jobs"; Postmark per `ARCHITECTURE.md`
  §9 is wired to that specific job, which doesn't exist). Building a
  form that submits somewhere and claims success while the message goes
  nowhere would be a worse outcome than the design's own unwired mock —
  silent data loss dressed up as confirmation, the same class of problem
  as the Google OAuth entry above, just with a passing form instead of a
  broken redirect. Composes a `mailto:` link from the filled fields and
  hands off to the user's own mail client instead — genuinely
  functional, needs no infrastructure this repo doesn't have, and the
  confirmation copy ("Your email app should have opened...") says
  exactly what happened rather than "Message sent."

**Other adaptations:** `SiteNav` gained an optional `active` (Contact
isn't one of the nav's four destinations — its own nav design has no
active item at all). Footer's "Schedule"/"How it works" fragment links
changed from bare `#schedule`/`#how` to `/#schedule`/`/#how` as part of
the extraction — the bare form only ever worked by accident, on `/`
where those ids exist; `SiteFooter` needed the full path to behave
correctly from Contact too. The global wave-1 `Nav`'s hide-list became a
`Set` rather than a fourth chained `||`, now that it's four routes long.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean (one warning
fixed: a plain `<a>` for an internal link, switched to `next/link`).
Headless Chromium: filled and submitted the form (confirmed the
in-app confirmation copy renders, not just that nothing crashed), light
and dark mode, a 420px mobile viewport, and — the actual regression this
pass caught and fixed — confirmed via `getAttribute("href")` that both
`/` and `/login`'s footers now link to `/contact` and that `/` itself
still renders correctly after the `SiteFooter` extraction. Zero console
errors throughout.

### 2026-08-10 — `/privacy` implemented from `Privacy.dc.html`; content fact-checked against `DOMAIN-MODEL.md` before shipping, not just laid out

Implemented `Privacy.dc.html`: a header band, a sticky scroll-spy table
of contents (236px sidebar, 7 numbered sections), and the same
floating-toggle-plus-no-toggle-footer chrome Contact and Login already
established. New route — `/privacy` didn't exist before.

**This is a legal document, so its factual claims got checked against
the real system before anything shipped — not just its layout copied.**
A privacy policy stating who can see what, or what a payment processor
does, is a claim about the actual system, unlike marketing copy on the
landing page. Checked `docs/DOMAIN-MODEL.md` line by line against the
design's §3 ("Who can see it") and confirmed rather than assumed:

- "Organisers ... everything, including payments" matches the `admin`
  role exactly (`roles` table: `admin` | `scheduler` | `coach` |
  `player`; `admin` — Cas, Michael — "everything," per DOMAIN-MODEL's own
  access table).
- "Schedulers ... rosters and attendance, no payments" matches the
  `scheduler` role's documented boundary word for word: "sessions,
  rosters with names and contact details, attendance, claims, waitlists,
  polls, notifications" but explicitly *not* "anything financial."
- "Other players ... first name and surname initial, never contact
  details" matches DOMAIN-MODEL §9's roster-visibility line exactly:
  "Players can see who else is on a session, in a reduced form — first
  name plus surname initial. Naomi sees full names."
- Hosting "in the EU" matches `ARCHITECTURE.md` §10 (Supabase
  `eu-central-1`, Vercel `fra1`, both Frankfurt).

Nothing needed correcting here — the design's own copy already tracked
the domain model closely, likely drawn from the same source. Recorded
as "checked and confirmed," not skipped, since the alternative (shipping
a legal page's factual claims unverified because they happened to look
plausible) isn't a shortcut this kind of page gets to take. "Mollie ...
handles iDEAL and Wero" was *not* re-litigated — same reasoning as the
register/how-it-works copy: Michael's standing instruction that Wero is
iDEAL's own succession path applies here too, not just to marketing
copy.

**Mechanics:** `toc-nav.tsx` (client) reimplements the design's own
scroll-spy exactly — the *last* section whose top has crossed 120px from
the viewport top is "current," via a plain scroll listener, not an
IntersectionObserver, to match that specific off-by-one-prone logic
rather than approximate it. All Privacy links across the app
(`site-footer.tsx`, `login/page.tsx`) now point to `/privacy`; the
wave-1 `Nav`'s hide-list gained a fifth route.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean. Headless
Chromium: scrolled to a middle section and confirmed the TOC highlights
it, clicked a TOC entry and confirmed the target section actually
receives the click (not just that nothing threw), light and dark mode,
a 420px mobile viewport (TOC un-stickies and stacks above content,
matching the design's own narrow-viewport behavior), and confirmed via
`getAttribute("href")` that the footer/contact-page cross-links resolve
correctly. One screenshot artifact investigated rather than assumed
benign: a faint duplicate logo appeared near the bottom of the
full-page capture — re-shot with a real `scrollTo` + viewport-only
screenshot instead of Playwright's `fullPage` stitching, confirmed
clean, and closed as the same known `position: sticky` capture artifact
noted earlier this session (now confirmed twice, not just asserted).
Zero console errors.

### 2026-08-10 — `/how-it-works` implemented from `How It Works.dc.html`; `TocNav` promoted to shared on its second real use

Implemented `How It Works.dc.html`: the same header-band/sticky-TOC/
numbered-sections shape as `/privacy` (same source design pattern —
architecturally identical), 7 sections on slots, roles, registering and
paying, missed weeks, waitlists/drop-ins, skills training, and level,
plus a closing CTA row ("Sign me up →" / "See the schedule").

**`toc-nav.tsx` and its TOC-specific CSS classes moved from
`app/privacy/` to shared (`app/toc-nav.tsx`, TOC classes into
`page.module.css`)** — this is a second real use of identical scroll-spy
*behavior*, not just similar-looking markup, the same bar `SiteNav` and
`SiteFooter` were held to at their own second uses. Confirmed the two
source designs' TOC markup is pixel-identical before sharing it (not
assumed from "they look similar"). **Deliberately did not** also merge
the surrounding numbered-section styling (`.section`, `.sectionNum`,
`.row`, etc.) into one shared module — checked the two designs' inline
styles side by side first and found a real difference: Privacy's section
numeral is 24px, How It Works' is 21px (matching its own h2 exactly). A
forced shared class would have silently made one of them wrong. Kept
`how-it-works.module.css` self-contained for that styling, consistent
with how `register.module.css`/`contact.module.css` already stayed
independent of each other despite looking similar. **Re-verified Privacy
after moving code it depends on** — didn't treat "the extraction looks
correct" as sufficient for already-shipped code: re-ran Privacy's
scroll-spy and dark-mode screenshots post-refactor before considering
the extraction done.

**Fact-checked against `DOMAIN-MODEL.md` before shipping, same bar as
Privacy** (this page states operational facts — slot counts, capacities,
deadlines — not brand copy): ten slots / eight scrimmage / two skills
training matches `fake-data.ts`'s `SLOTS`; 20 skater / 2 goalie
scrimmage capacity and the goalie season-rate discount match
`SCRIMMAGE_CAPACITY`/`SCRIMMAGE_PRICE`; "decline up to 48 hours ahead"
matches `RELEASE_HOURS_BEFORE`; the "10 minutes" hold matches
`HOLD_MINUTES`; "first come, first served, no priority queue" matches
D2's passive-only vetting decision; the four divisions listed (2nd/3rd,
3rd/4th, 5th/6th, recreational) match the real `SLOTS` labels exactly;
"advisory, not a gate" matches DOMAIN-MODEL's explicit "no level
filtering ... never a hidden option." Nothing needed correcting.

**Resolved a previously-provisional decision, not a new one:** every
"How it works" link across the app (`SiteNav`, `SiteFooter`, Login's
footer, Contact's sidebar) pointed at `/#how` — the landing page's
teaser section — because this dedicated page didn't exist yet. That was
recorded explicitly as a stand-in at the time (see the earlier landing-
page `DECISIONS.md` entry: "this repo doesn't have that as its own
route"). Now that it does, every one of those links points to
`/how-it-works` instead. The landing page's own `#how` teaser section
is untouched — the two coexist by design, a short teaser linking out to
the full reference, matching how the source design project structures
both pages as separate files in the first place. `SiteNav` gained
`active === "how"`.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean. Headless
Chromium: scroll-spy confirmed live, a TOC click confirmed to actually
scroll, light/dark, 420px mobile, the CTA row's two links confirmed via
`getAttribute("href")` (`/register`, `/#schedule`), every cross-page
"How it works" link (nav, both footers, Contact's sidebar) confirmed to
resolve to `/how-it-works`, and — the actual regression risk this pass
carried — Privacy re-screenshotted post-refactor (scroll-spy still
correct, section numeral still 24px, dark mode intact). Zero console
errors throughout.

### 2026-08-11 — Theme toggle unified to one placement, per direct product feedback

Michael: "The light/dark toggle should not be pinned to the footer, it
should live in the bottom right corner of the page and scroll with the
page." Reconciled the two placements the source design used
inconsistently across its own files — a small bordered icon embedded in
the footer's link row (landing, and, until this pass, Contact/Privacy/
How It Works via `SiteFooter`'s `themeToggle` prop) versus a
`position: fixed` viewport-pinned button (Login, and the "floating"
`variant` the other pages opted into) — into a single approach: `.page`
is now `position: relative`, and `ThemeToggle` is `position: absolute;
right: 24px; bottom: 24px` against it. Anchoring to the page's own box
rather than the viewport is what makes it scroll away with the content
instead of staying pinned on screen, and living outside `SiteFooter`
entirely (rather than as one of its flex children) is what makes it not
"pinned to the footer" — the two requirements are actually the same
underlying fix, not two separate ones.

**`variant` and the footer's `themeToggle` prop are gone, not just
defaulted differently** — there is exactly one shape now, so a prop
selecting between shapes would be dead surface. Every page (`/`,
`/register`, `/login`, `/contact`, `/privacy`, `/how-it-works`) renders
its own standalone `<ThemeToggle />` once, near the footer in JSX but
not inside it.

**Found a real click-blocking bug via testing, not by inspection:**
register's fixed checkout bar (`.stickyBar`, `position: fixed`, the
"Continue" button) occupies the same bottom-right corner the toggle
defaults to. A plain visual screenshot wouldn't have caught this — it
looked fine — but an actual Playwright click against the toggle timed
out with `<div class="...stickyBar"> intercepts pointer events`,
confirming the bar was silently swallowing the click rather than merely
looking crowded. Measured the bar's real rendered height (`~83px`, via
`boundingBox()`, not guessed) and added a targeted escape hatch —
`ThemeToggle`'s new `offsetBottom` prop, used only by register-client.tsx
(`100px` while the bar is showing, back to the shared default once
`paid` removes it) — rather than raising the toggle's `z-index` above
the bar's, which would have made it render on top of and potentially
overlap the checkout content instead of sitting cleanly above it.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean. Headless
Chromium across all six pages: exactly one toggle per page (no
leftover duplicates from the old footer/floating split), `getComputedStyle
().position === "absolute"` on each (not `"fixed"`), and — the direct
proof of "scrolls with the page" — the toggle's viewport-relative
bounding box sits far below the 900px viewport when scrolled to the
very top of each page, meaning it isn't visible until scrolled down to
it, the opposite of a fixed element. Clicked and confirmed dark-mode
toggled successfully on every page, including register post-fix (the
same click that previously timed out). Zero console errors throughout.

### 2026-08-11 — Privacy page grounded in the real business: real Terms & Conditions, real KVK/BTW, real contact address

Michael: "The privacy page needs to be updated to synthesize the info
from https://www.summerice.nl/terms-conditions/. Also, the true KVK
info from the bottom of summerice.nl needs to be included."

**Couldn't fetch either source — reported the blocker instead of
guessing.** `WebFetch` returned `403 Forbidden` on the terms page, the
bare domain, and a `web.archive.org` fallback; `web.archive.org` itself
turned out to be blocked outright for the tool; `WebSearch` found
nothing relevant (an unrelated ice-cream-seller Facebook page came up
under the same name — noted and discarded, not treated as a lead). A
privacy page is exactly the place where fabricating a KVK number or
invented terms language to fill a gap would be a real integrity
problem, not a shortcut — asked Michael to paste the content rather
than proceeding without it.

**What changed, once he did — two genuinely new pieces of ground
truth, not just formatting:**

- **A new §07, "Payments and cancellations"**, synthesizing (not
  reproducing verbatim — the real terms run to ten sections covering
  liability, health and safety, participant responsibilities, none of
  which belong on a *privacy* page) the parts of the real terms that
  are actually privacy-page-adjacent: the 14-day statutory cooling-off
  period (Dutch BW Art. 6:230o–6:230s), pro-rated refunds once sessions
  have already been delivered, non-refundable after 14 days unless
  stated otherwise, and the Dutch-consumer-law/EU-consumer-protection
  governing-law statement — with a real external link to the full terms
  rather than a promise to reproduce them. Recognized this content is
  contract law, not data privacy, and deliberately kept it to a
  three-row summary plus a link out rather than importing all ten
  sections onto a page that isn't the right home for them.
- **A new §09, "Who we are"**: the real legal entity ("Summer Ice is a
  trade name of The Goalie Store"), KVK `81043333`, VAT `NL003525536B16`
  — standard GDPR Article 13 data-controller identification a privacy
  policy is supposed to carry, and simply wasn't checkable before now.
  §08 ("Questions") also gained the real direct contact
  (`info@summerice.nl`, `+31 6 18367156`) alongside the existing
  `/contact` link.
- TOC grew from 7 entries to 9 to match.

**Found and fixed a related, previously-unverifiable guess while doing
this:** the Contact page's email has read `hello@summerice.nl` since
the `.club`→`.nl` domain correction two sessions ago — a corrected
domain, but a guessed local part, never confirmed. The real terms page
gives the actual address: `info@summerice.nl`. Corrected in both
places it lived (`contact/page.tsx`'s sidebar link,
`contact-form.tsx`'s `CONTACT_EMAIL` constant) rather than left
standing now that better evidence exists — not something Michael asked
for in this message, but the same class of fix as the domain
correction itself, flagged rather than done silently.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean. Headless
Chromium: confirmed 9 TOC entries render, the external terms link
resolves to the real URL with `target="_blank"`, both the new §08 email
link and the Contact page's corrected email link point to
`info@summerice.nl`, scroll-spy still correctly highlights §07 when
scrolled to it, dark mode intact on the new sections, zero console
errors.

### 2026-08-11 — Theme toggle still read as "in the footer" after the position fix; the actual complaint was overlap, not the DOM

Michael, immediately after the previous entry's fix landed: "It looks
like the light/dark toggle is still stuck in the footer. Sorry I missed
it earlier." Worth recording precisely because the earlier fix *was*
correct on its own terms — `position: absolute` against `.page`, not
`fixed`, not a child of `SiteFooter` — and still didn't satisfy the
actual request. The gap: `.page`'s box ends exactly where the footer
ends, so the toggle's default `bottom: 24px` placed it vertically
*inside* the footer's own rendered band, just to the right of its link
row. Structurally separate, visually indistinguishable from "one more
footer item" — confirmed by re-examining that pass's own screenshots,
where this is plainly visible in hindsight.

**Fix: `.page` gained `padding-bottom: 100px`.** The toggle still
anchors to `.page`'s bottom edge the same way; the difference is that
edge now sits 100px past the footer instead of flush with it, so the
toggle occupies genuine empty space below the footer rather than
sharing its band. A CSS-only change — no component, no prop, applies to
all six pages uniformly through the shared `.page` class every one of
them already uses (including `/login`, whose own simpler footer had the
identical overlap).

**Verified:** re-ran the same six-page Playwright suite from the
previous entry unchanged (one toggle each, `position: absolute`,
working click, dark-mode toggles) — all still passed after the padding
change, confirming it didn't regress the actual mechanics. Then looked
at the screenshots specifically for the thing that was actually wrong:
confirmed visually, on both landing (full-page) and login, that the
toggle now sits in clear space below the footer's border and background
band, not overlapping its row. Zero console errors.

### 2026-08-11 — Design handoff bundle: theme toggle reverted to fixed (again), "How it works" demoted, landing CTA hierarchy rebuilt

Michael handed off a zip (`design_handoff_landing_ctas`, synced from the
design project as of `2026-08-11T06:19:30Z`) with an unusually detailed
README — exact pixel values, exact copy, a stated fidelity level
("final colors, type, and spacing... every color is an existing
token"), and its own accounting of what changed since the last sync.
Cross-checked the README's claims against the bundled `.dc.html` files
directly rather than trusting the prose alone (all six pages' nav/
footer markup, the landing page's new sections) — everything matched.

**§1 — the theme toggle flips back to `position: fixed`, explicitly
reversing yesterday's two rounds of fixes.** The README says so
outright: "This reverses the earlier reconciliation — the current file
comments describing the absolute behaviour as intentional need
updating." Worth being explicit about rather than quietly implementing:
this is a direct contradiction of Michael's own two prior instructions
in this same session ("should not be pinned... should scroll with the
page," then the footer-overlap follow-up). Treated as authoritative
anyway — the README demonstrates specific awareness of the current
absolute-positioned state it's reversing, which reads as an informed
decision made through the design tool after seeing the result, not a
stale artifact that missed the conversation. Implemented as specified:
`.themeToggle` back to `position: fixed`, `z-index: 60` (was `5` —
needs to clear the sticky nav and register's checkout bar again, the
original reason it was that high before yesterday's absolute pass
dropped it). `.page`'s now-pointless `position: relative` and
`padding-bottom: 100px` (both existed only to serve the absolute
approach) removed rather than left as dead CSS. The README's own fix
for the toggle-over-footer problem is different this time, and more
direct: `.footerInner`'s bottom padding goes `34px` → `76px` (24px
inset + 44px button + 8px clearance) instead of adding space to `.page`
— the footer makes room for the button sitting over it, rather than the
page making room for the button below the footer.

**§2 — "How it works" removed from persistent nav.** Dropped from both
`SiteNav` (the `active` union loses `"how"`) and `SiteFooter` entirely.
Still reachable — the landing page's own `#how` section gets a new
"Read how it all works →" link (§4d below), and Contact's sidebar note
was already pointing there and stays untouched (confirmed by grep,
since none of this pass's edits touched `contact/page.tsx` directly).

**§3 — landing page vertical rhythm**, nine exact padding/gap value
changes across `.heroInner`, `.stat`, `.main`, `.sectionHead`, `.row`,
`.scheduleHead` (all in `page.module.css`) to bring the schedule table
above the fold. Applied verbatim from the README's table.

**§4 — the actual point of the handoff: one filled button per zone,
color carries meaning.** The problem statement in the README is worth
recording because it's a real critique of what shipped two sessions
ago: season signup appeared as three different verbs (nav "Register,"
hero "Sign me up," ten filled "Claim →" row buttons), "See the
schedule" pointed at a table already on screen, and the drop-in path
read as a consolation prize with no reserves-list option at all.

- Hero: removed the `.btnSun` "See the schedule" link, one `.btnPrimary`
  remains.
- Schedule rows: `.claimBtn` filled→outlined (fills on hover), "Claim →"
  → "Season spot →". `.waitlistBtn` unchanged, "Join waitlist →" →
  "Join reserves →" — the actual ambiguity fix, since a full slot's
  action is that slot's own reserves list, not a season queue.
- The `.dropin` section — one card, one route — is gone, replaced by
  `.waysIn` ("Two more ways in"): two named, distinguishable routes
  (reserves list → `/contact`, filled sun; drop-in → `/register`,
  outlined sun), sourced from copy the README attributes to the
  original site ("it is also possible to join sessions on a
  week-to-week basis..."). The reserves route didn't exist on the
  homepage at all before this.
- New `.howLinkRow`/`.howLink` after the three `.howCard`s — the
  replacement entry point to `/how-it-works` now that nav doesn't carry
  it.
- `.ctaSection` moved off the sun gradient onto the neutral card — sun
  now means "one-off/week-to-week" consistently after `.waysIn` claimed
  it, so the season-commitment closer (a season action, not a one-off)
  moved to match, per the same color-carries-meaning rule.
- `.btnSun` is fully unused after all of the above (confirmed by
  grep across the whole `apps/web` tree, not assumed) — removed as dead
  code rather than left "in case," even though the README's own aside
  ("still used elsewhere — see 4c") expected it to survive. It didn't:
  the two new sun buttons in `.waysIn` need `10px 20px`/`13px` sizing,
  `.btnSun` was `12px 24px`/`14px` (the hero's size) — genuinely
  different specs, not reusable verbatim, so dedicated classes were the
  correct call regardless of what the aside anticipated.

**One deliberate content judgment call, flagged rather than resolved
silently:** the README itself poses an open question — "Ask to be
added" points at `/contact` because the real source copy says to reach
out, but if reserves become self-serve later it should point into
`/register` and read "Join the reserves →" instead. Implemented exactly
as specified (`/contact`, "Ask to be added →") and left the open
question as an inline code comment at the call site rather than
guessing which way product intends to take it.

**Not committed:** the handoff zip itself
(`apps/web/Summer ice hockey landing page.zip`) — a transient input
artifact, the same treatment every `.dc.html` design reference has had
all session: read from, translated into real Next.js/CSS-module code,
never checked into the repo itself.

**Verified:** `npx tsc --noEmit` (root) and `eslint` clean. Headless
Chromium: confirmed zero "How it works" nav links across all six pages
(`nav a` count check, not just eyeballing — Privacy/How It Works's TOC
`<nav>` inflates the raw link count, accounted for that rather than
misreading it as a bug), exactly one hero action button, all ten rows
read "Season spot →", the `.waysIn` links resolve to `/contact` and
`/register` respectively, the how-it-works link resolves to
`/how-it-works`, the toggle's computed `position` is `"fixed"` and —
the direct proof it now stays on screen — its bounding box is still
inside the 900px viewport when scrolled to page-top (the opposite of
last round's "proof" that it scrolled away). Clicked it successfully on
every page including register (still clears the checkout bar, unchanged
`offsetBottom={100}`), and confirmed the footer's "Privacy" link is
still clickable despite the toggle now sitting fixed over that corner —
the actual bug the padding change exists to prevent, not just "it
looks fine." 420px mobile confirmed the new `.waysInRow`s collapse to a
single column with the action left-aligned below the text, matching
the README's responsive note. Zero console errors throughout.

### 2026-08-11 — Landing hero: split layout → stacked, centered (design handoff follow-up)

Michael reported "a small error on the homepage" and attached a second
handoff zip (`Summer ice hockey landing page(1).zip`, same
`design_handoff_landing_ctas` bundle, README dated after the previous
sync). The README's own §4a says it plainly: "The layout one was
missed in the last pass — the shipped hero is still the split layout;
it should be stacked." The earlier pass (previous commit, `adb0c9e`)
correctly tightened the split layout's padding per the README's §3
table but never implemented the actual layout change §4a called for —
an oversight in that pass, not a new design decision.

Fixed to match §4a exactly: `.heroInner` goes from a two-column grid
(`1fr auto`, logo right) to a single centered flex column (`max-width:
760px`, `flex-direction: column`, `align-items: center`, `text-align:
center`, `gap: 16px`), with the logo now first in reading order at a
fixed 92×92 (was `clamp(96px, 11vw, 140px)` in the right-hand column).
The title drops its forced `<br />` — "Ice hockey, all summer." is one
string now, sized up slightly (`clamp(34px, 5.4vw, 58px)`, was
`clamp(34px, 4.8vw, 54px)`) to compensate for the narrower column. The
child elements' individual `margin-bottom`s are gone in favor of the
flex `gap` — but only inside the hero: `.eyebrow` is shared with three
other section heads (schedule/how/rink) that still need their own
`margin-bottom: 14px`, so the reset is scoped as `.heroInner .eyebrow`
rather than changed on the shared class. The old `@media (max-width:
720px)` block that existed solely to center the split grid on mobile
is deleted outright — the new layout is centered at every width, so
the media query has nothing left to do; `.heroLive`/`.heroActions`
get `justify-content: center` unconditionally instead.

Verified against a **freshly started** dev server, not the one already
listening on :3000 — that process turned out to be a stale leftover
from the prior day's session (started 2026-08-10, well before this
commit's edits) that was serving pre-redesign wave-1 fake-data HTML
despite Turbopack's file watching normally picking up saves; rather
than chase why, it and its sibling on :3001 were killed and a clean
`next dev` confirmed the fix. Computed styles pulled directly via
Playwright's `getComputedStyle` (not eyeballed from a screenshot alone)
confirmed `display: flex`, `flex-direction: column`, `max-width:
760px`, the single-line title with no `<br>`, and a 92×92 logo.
Screenshotted light, dark, and 390px mobile — all match the handoff's
mockup — plus a full-page shot confirming the rest of the page
(schedule, ways-in, CTA band) is unaffected, and a `/register` check
confirming the ordinary route/nav still renders with zero console
errors. `tsc --noEmit` and `eslint` both clean. The handoff zip
(`apps/web/Summer ice hockey landing page(1).zip`) was, again, not
committed.

### 2026-08-11 — Design handoff bundle: season/drop-ins rework (`design_handoff_season_dropins`)

Michael handed off a third zip (`Summer ice hockey landing page(3).zip`,
bundle `design_handoff_season_dropins`) — a substantial rework, not
another small fix. Four themes: home hero rebuilt around two CTA cards
(season / this-week drop-in), a brand-new `/drop-ins` route, `/register`
rebuilt into the same six-column week-grid language, and a global
placement change for the theme toggle (third round this session — see
below).

**Stopped before implementing on a real business-fact conflict, per
CLAUDE.md's session ritual.** The handoff's own business-rules table
claimed skills-training goalie pricing at €600 and Wednesday-skills-
training-is-skaters-only as settled facts. Both contradicted
`DOMAIN-MODEL.md`: D3 (settled) already fixed goalie skills pricing at
€450, same rate as skater; D12 (open) explicitly said Skills Training
capacity — for *both* positions — was unestablished, "needs Cas." Rather
than quietly implement the handoff's numbers (silently overriding a
settled decision) or quietly keep the old numbers (silently ignoring
what might be genuine new information), asked Michael directly via
`AskUserQuestion`. Answer on both: treat the handoff as authoritative —
adopt €600, adopt Wednesday-skaters-only. `DOMAIN-MODEL.md` updated
accordingly: D3's outcome rewritten to note the reversal and that
skater/goalie skills rates are no longer equal; D12 moved from Open to
Settled with an outcome text that's honest about *what* is now decided
(the Wednesday-specific shape) versus what still isn't (the actual
skater/goalie capacity magnitudes — 16/4 remains an unconfirmed
placeholder, unchanged). `fake-data.ts` updated to match: `SKILLS_PRICE
.goalie.seasonCents` → 60000; a new `SKILLS_CAPACITY_SKATERS_ONLY`
override applied only to `wed-2015`; `wed-2015`'s `ROSTER_CONFIG` goalie
counts zeroed (a nonzero count on a zero-capacity slot would have been
silently wrong). Both changes are recorded as sourced from this design
handoff, not from Cas directly — flagged for follow-up if that's ever
wrong.

**Theme toggle, third placement this session.** `position: absolute` →
`position: fixed` → now a `position: sticky` track (`.themeToggleTrack`,
`margin-top: auto`, rendered as the flex child immediately before
`<SiteFooter />`) that floats 24px above the viewport while scrolling
through page content and settles 20px above the footer once the page
actually ends — solved structurally (the track has nowhere further to
stick once the footer pushes it into view) rather than by the
`position: fixed` + oversized footer-padding hack the last two rounds
used. Footer padding reverts to 26px now that nothing needs clearing.
`offsetBottom` (register's one-off prop for clearing its old fixed
checkout bar) is gone entirely — register's checkout bar is itself
`position: sticky` now with 92px of reserved right-padding, so the two
elements coexist by construction instead of one dodging the other.
`ThemeToggle`/`SiteFooter` render order flipped (toggle first) on all
six pages that use the shared footer, since the sticky-track trick only
works with the toggle immediately *before* the footer in flow.

**New route: `/drop-ins`** (`app/drop-ins/page.tsx` + `drop-ins-
client.tsx` + `drop-ins.module.css`). Six-column week calendar (real
`sessionDetail()` data, not the handoff's own inert example array),
role/level filter pills, per-role tap-target rows (green/amber/selected/
full), a full-session waitlist toggle, an always-mounted sticky checkout
bar, and a checkout modal — all local component state, no backend call,
matching the no-backend-yet treatment `register-client.tsx` already
established for its own basket flow. `GoogleSignInButton` promoted from
`login/` to a shared top-level component once the checkout modal became
a second real use of the identical disabled button.

**`/register` rebuilt into the matching week grid — a real behaviour
change, not just a restyle.** The old "I play as a Skater/Goalie/Both"
global role setting is gone. Every card now shows whichever role rows
have capacity (skater always; goalie unless the slot is skaters-only),
and a role is picked per night by clicking its row — one role per slot,
replaceable, exactly matching `/drop-ins`'s interaction. "I play" is now
a pure filter (hides rows/cards with no room for that role), not a
registration setting. Waitlisting also changes shape: reserves are now
entirely separate from the payable basket (a boolean per full slot,
contributing nothing to the total) rather than the old basket's
"waitlisted" line kind — matching the handoff's own `picks` vs.
`reserves` state split. Register also gains a footer for the first time
(the previous version had none — the design's own markup includes the
standard one, closing what reads like a gap rather than a deliberate
omission).

**Deliberately deviated from the README's own suggestion** to share the
week-grid as one component between `/register` and `/drop-ins` — built
as two page-scoped CSS modules and two page-scoped render trees instead.
The two differ in enough real values (30px vs. 38px role rows, 172px vs.
168px cards, `--sun` vs. `--primary` selection color, dates vs. weekday-
only columns, a price shown per row on one but not the other) that a
shared component would need nearly as many per-page overrides as it
saved — same reasoning already applied to Privacy/How It Works' section
numerals earlier in this session.

**Bugs the browser-verification pass caught, not just cosmetic
mismatches:**
- The wave-1 walk-through nav (`app/components/nav.tsx`) doesn't know
  about new routes by default — it hides itself only on a hardcoded set
  of "restyled" paths, and `/drop-ins` wasn't in it, so the plain
  five-link nav was rendering stacked above the real one. Added
  `/drop-ins` to `RESTYLED_ROUTES`. Worth remembering for the next new
  route this pattern needs updating for.
- The sticky checkout bar's right-hand group (total + CTA, plus
  register's hold-countdown note) had no wrap rule of its own at mobile
  widths — only the outer bar wrapped, so at 390px the inner group
  overflowed the viewport instead of stacking. Fixed by giving
  `.stickyRight`/`.checkoutRight` their own `flex-wrap: wrap` at the
  existing breakpoint; register additionally drops the hold-countdown
  note there as the least essential piece. Caught via a real scroll-and-
  screenshot check, not a `fullPage` capture — `fullPage` screenshots
  render `position: sticky` elements frozen at an arbitrary mid-document
  position and made this look like a much stranger layering bug than it
  actually was before the real check clarified it.

**Verified:** `tsc --noEmit` and a full `eslint app` pass both clean
across the whole repo. A 31-check headless-Chromium pass (Playwright,
the `apt-get download`/`dpkg-deb -x`/`LD_LIBRARY_PATH` no-root
workaround) against a live dev server covering home (light/dark/
mobile), drop-ins (default/selected/checkout-modal-open/checkout-modal-
closed/filtered/dark/mobile), register (default/selected/contention-
demo/dark/mobile), login and How It Works — zero console errors
anywhere, both real bugs above caught and fixed before this was called
done. The handoff zip (`apps/web/Summer ice hockey landing page(3).zip`)
was not committed, same treatment as every design reference this
session.
