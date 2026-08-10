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
