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
