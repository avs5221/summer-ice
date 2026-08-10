# Summer Ice — Architecture

**Status:** draft for review
**Companion to:** `DOMAIN-MODEL.md`, which defines *what* the system does. This document defines *how* it is built and deployed.

Every Claude Code session starts by reading both documents. `DOMAIN-MODEL.md` is authoritative on behaviour; this file is authoritative on structure. Where they appear to conflict, the domain model wins and this file is wrong.

---

## Why this stack, in one page

Two previous attempts on Supabase + Vercel produced a long bug list:

- PostgREST silently capping results at 1,000 rows regardless of `.limit()`
- `.eq('season_id')` failing silently on registrations, because the season is reached through slots
- `users.id` diverging from the Supabase auth UID
- Realtime failing on `realtime.messages` RLS until replaced by a public-channel broadcast trigger
- Vercel stripping the `Authorization` header from `pg_net`, forcing a custom `x-cron-secret`
- Vercel's build cache inlining stale environment variable values
- Six cron jobs split across `pg_cron` and edge functions, with correctness depending on a sweeper firing

An earlier draft of this document read that list as an indictment of the platform itself and moved everything onto a self-hosted Hetzner box — one Postgres, one Node app, one worker process, one Linux box, owned and operated solo. That was a misdiagnosis. `docs/CONTEXT.md` §5 has the honest account of getting this wrong once already; the short version is below.

Re-read item by item, the list doesn't point at Supabase or Vercel. It points at two specific things:

- **PostgREST.** The row cap, the silent join failure and the UID mismatch are all consequences of going through an auto-generated REST layer instead of a real query builder talking to Postgres directly.
- **RLS.** The Realtime authorization failure — and the general cost of writing and debugging row-level security policies for logic a server-side check would express directly — comes from routing authorization through the database's policy engine instead of through code.

The `pg_net` header-stripping and build-cache items are real but narrower, and don't require leaving the platform either: don't use `pg_net` (Vercel Cron calling a route handler needs no database-initiated HTTP call), and never inline environment variables at build time (Vercel's own env var system, read at runtime, avoids this entirely).

This architecture keeps Supabase and Vercel and deletes the two actual causes: **no PostgREST, no RLS on application data.** All data access goes through Drizzle over a direct Postgres connection; every authorization check is server-side code, not a database policy. That's a smaller, more targeted fix than rebuilding on owned infrastructure — and re-owning a box, a reverse proxy, backups and a job queue personally, on top of building the actual application solo on a deadline, was the over-engineering, not the platform. See §14 for where the self-hosted plan ended up.

---

## 1. Shape of the system

Supabase Postgres, a Next.js App Router application on Vercel, no separate worker process.

```
                 ┌───────────────────────────────┐
 browser    ───► │  Vercel                       │
                 │   Next.js App Router          │
 Expo app   ───► │    Server Components (fetch)  │──┐
                 │    Server Actions             │  │
                 │    app/api/* route handlers   │  ├──► packages/core
 Vercel Cron ──► │    (drains the outbox table)  │  │    (domain logic)
                 └───────────────────────────────┘  │
                                                     │
                 ┌───────────────────────────────┐  │
 browser    ◄─── │  Supabase                     │◄─┘
 (Realtime       │   Postgres — pooled :6543,    │
  broadcast)     │             direct :5432 (§5) │
                 │   Auth, behind `credentials`  │
                 │   Realtime (broadcast)        │
                 └───────────────────────────────┘
```

Both browser arrows are real: the app talks to Postgres server-side via Drizzle; the browser talks to Supabase Realtime directly for the live-fill broadcast (§8) — the one thing that bypasses the Next.js server on purpose.

Web and native are two clients of one API — the `app/api/*` route handlers, once anything beyond wave-1 fake data needs them. Nothing crosses an HTTP boundary to reach the database: Next.js talks to Postgres directly via Drizzle, in-process, exactly as the self-hosted design did. The only things that changed are who operates the Postgres instance and where the Node process runs.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node 24.19.0 | Vercel-managed in production; v8 (Next) floor is 22.22 |
| Language | TypeScript 6.x, strict | ESM throughout. **Not** 7.x — see below |
| Web framework | Next.js 16.3.0, App Router | Server Components fetch, Client Components handle interaction, `app/api/*` route handlers are the API surface for the future mobile client |
| React | 19.2.8 | |
| Styling | Tailwind 4.3.3 | via `@tailwindcss/postcss` |
| Database | Supabase Postgres | Local Docker (`packages/db/docker-compose.yml`) for development only — see §5 |
| Query layer | Drizzle, over `postgres` (postgres-js) | Schema-as-code, generated migrations. **Never** PostgREST, **never** `supabase-js`, for data access — see §5 |
| Jobs | Vercel Cron + an outbox table | No pg-boss, no worker process — see §6 |
| Realtime | Supabase Realtime, broadcast from a trigger | Public channel, never `postgres_changes` — see §8 |
| Auth | Supabase Auth, behind `credentials` | Decided, not yet implemented this session — see §7 |
| Native | Expo / React Native | Ships Feb–Mar, after web launch |
| Email | Postmark | Transactional only |
| Payments | Mollie | Live account already active |
| Hosting | Vercel | Frankfurt (`fra1`) region — see §10 |

Pin exact versions at scaffold time and do not chase minors between September and December.

**Installed and verified, August 2026:**

| Package | Version |
|---|---|
| next | 16.3.0 |
| react / react-dom | 19.2.8 |
| tailwindcss | 4.3.3 |
| drizzle-orm | 0.45.2 |
| drizzle-kit | 0.31.10 |
| postgres (postgres-js) | 3.4.9 |
| @supabase/supabase-js | 2.112.2 |
| typescript | 6.x — **not 7.x**, see below |

**TypeScript stays on the 6.x line.** TypeScript 7.0 went GA on 8 July 2026 as the Go-native port and is genuinely ~10x faster, but it ships without a public compiler API until 7.1, which means **typescript-eslint cannot run on it**. It also has incomplete project-reference `--build` support, no declaration emit, and diagnostics that do not yet match the classic compiler exactly. Linting and exact diagnostics matter more than compile speed on a repo this size, where a full check takes seconds either way. Microsoft runs a dual track with 6.x supported for compatibility, so this is a supported position rather than a dead end. Revisit once 7.1 ships the API and the ecosystem catches up.

**Not verified — check at install:** current Expo SDK.

**Resolved — was an open risk, now covered by a shim.** §5's primary-key convention assumes native `uuidv7()`, a **Postgres 18** feature. Confirmed directly against the real Supabase project (not just Supabase's general docs): Postgres **17.6**, no `uuidv7()` at all. Rather than gate the schema on Supabase's Postgres 18 timeline, `packages/db/migrations/0000_uuidv7_shim.sql` provides a pure-SQL, spec-compliant implementation that runs before every other migration and gets out of the way automatically once the real built-in exists — see §5, "`uuidv7()` compatibility shim." Local development is unaffected either way: `packages/db/docker-compose.yml` runs Postgres 18 directly, so the shim's own guard skips creating it there, matching §5 exactly.

### Build-step constraints

There is no manual compile step. `packages/*` export TypeScript source directly; `apps/web` compiles through Next's own SWC-based toolchain (`next dev` / `next build`).

There is **no longer** a type-stripping constraint on `packages/core`. That constraint existed only because `apps/worker` ran its `.ts` files straight through Node's runtime type stripper (no `enum`, no `namespace`, no constructor parameter properties — erasure, not compilation). `apps/worker` is gone (see §6); nothing in this repo runs TypeScript that way any more, so `packages/core` can use ordinary idiomatic TypeScript without that restriction.

Formal TypeScript project references (`composite` + `references`) are still not used; the graph is wired through path aliases plus `workspace:*` dependencies — see the note above this section.

### Why Next.js

Chosen for documentation density, not framework preference. Supabase's own quickstarts and `@supabase/ssr` guidance are Next-first, and this project is built by a solo developer working through an agent — the volume and currency of available documentation matters more here than which framework is the theoretically better fit. See `docs/CONTEXT.md` §5's correction for the full reasoning, including why the earlier "Why not Next.js" version of this section was wrong.

The API-surface argument survives the framework change unchanged: with a native client on the way, the JSON API is still the product, not an afterthought. `app/api/*` route handlers serve that role in the App Router exactly as resource routes did in React Router — Server Components and Server Actions are web-client conveniences, never where domain logic lives (§4.1 still applies to all three).

### Version traps

- `params` (and `searchParams`) on a page or layout are a `Promise` in the App Router, not a plain object — `await` them. This is a type error if missed, not a silent bug, but worth stating since it's easy to write from muscle memory otherwise.
- Next 16 auto-generates `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` on `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`). Commit them rather than fighting the regeneration — removing them from a diff only recreates the same uncommitted change next time `next dev` runs.
- `next typegen` is the direct equivalent of the old `react-router typegen` — see `CLAUDE.md`'s TypeScript section.
- Do not install `react-router` or any React Router package. Nothing in this repo uses it any more.

---

## 3. Repository layout

pnpm workspaces.

```
summer-ice/
├── packages/
│   ├── core/           domain logic — framework-agnostic
│   ├── contracts/      Zod schemas, derived types, API client
│   └── db/              Drizzle schema, migrations, seed
│                        docker-compose.yml — LOCAL DEV Postgres only
├── apps/
│   ├── web/             Next.js App Router
│   │                     app/api/* route handlers, incl. the Vercel Cron
│   │                     endpoint(s) that drain the outbox table
│   └── mobile/          Expo (phase 4)
├── DOMAIN-MODEL.md
├── ARCHITECTURE.md
├── CONTEXT.md
└── CLAUDE.md
```

There is no `apps/worker` and no `infra/`. Production Postgres, auth and realtime are Supabase's; the application runs on Vercel. `packages/db/docker-compose.yml` exists solely so development and migrations have a real Postgres to run against without touching the Supabase project for every schema change — see §5 and §10.

`packages/contracts` is what makes web and native consistent. Schemas are defined once, types derived from them, and both clients use the generated API client. Components are **not** shared — `react-native-web` promises more than it delivers. Consistency comes from shared logic and shared tokens, not shared JSX.

---

## 4. Invariants

These are the rules that exist because previous attempts broke them. They are not stylistic preferences.

### 4.1 Domain logic lives in `packages/core` and takes a transaction handle

Every operation that touches capacity, money or state is a function in `packages/core` with the signature shape:

```ts
async function claimSpot(tx: Tx, input: ClaimInput): Promise<ClaimResult>
```

Server Components, Server Actions, `app/api/*` route handlers and the Cron endpoint that drains the outbox (§6) are thin callers. They parse input, call core, and render or serialise the result. **No domain logic in a page, action or route handler, ever.**

This is what keeps web and native from diverging, and it is what makes the concurrency rules testable against a real database with no HTTP involved.

### 4.2 Availability is always computed, never stored

There is no `spots_remaining` column. Availability is derived at read time, with expiry inline:

```
capacity
  − confirmed
  − held      WHERE hold_expires_at > now()
  − offered   WHERE offer_expires_at > now()
```

An abandoned hold stops consuming capacity the moment it lapses, whether or not a sweeper has run. The sweeper is housekeeping. Correctness never depends on a job firing.

### 4.3 Capacity mutations lock, and lock in a fixed order

Every capacity change happens inside one transaction that first acquires the capacity row:

```sql
SELECT * FROM ice_session_capacities
 WHERE ice_session_id = $1 AND position = $2
   FOR UPDATE;
```

Multi-line carts acquire locks in **ascending `(slot_id, position)`** order without exception. Two players selecting overlapping slot sets in different orders will otherwise deadlock under load — a one-line detail that is miserable to diagnose in January.

No advisory locks. No application-level counting.

### 4.4 The database prevents duplicates, not the application

```sql
CREATE UNIQUE INDEX ON registrations (person_id, slot_id, position)
  WHERE status IN ('held', 'offered', 'confirmed');
```

Application logic will eventually have a hole in it. An index will not.

### 4.5 The Mollie webhook is the only authority on payment

The return URL is UX. Users close tabs, lose signal and background their bank app. Only the webhook transitions a registration or claim to `confirmed`.

Webhook handling is idempotent on Mollie payment ID, because Mollie retries.

### 4.6 Jobs are enqueued inside the transaction that caused them

An outbox row is inserted through the same connection, in the same transaction, as the change that causes it — see §6. Releasing a spot and recording the notification it owes commit together or not at all. It must be structurally impossible to have a released spot nobody was told about.

This is the specific failure that made a previous attempt's `notify-drops` fragile, and it is designed out rather than coded around. Swapping pg-boss for an outbox table (§6) preserves this invariant exactly — the mechanism changed, the guarantee didn't.

### 4.7 Display and notification count availability differently, on purpose

The number shown on a page **includes** pending holds — otherwise a player races for a spot already in someone's checkout. The `spot_open` notification trigger **excludes** them — otherwise an abandoned checkout re-announces a spot that never moved.

Same rows, two derived values, two jobs. Do not "fix" the inconsistency.

### 4.8 Money is append-only

`ledger_entries` are never updated and never deleted. Corrections are new offsetting entries. Balance is `SUM(amount_cents)` per person. Positive means the person owes the league; negative means the league owes them, which is how coach payables share the table.

---

## 5. Data access

Drizzle for schema, migrations and ordinary queries. Raw SQL via Drizzle's escape hatch for the capacity and availability queries — those are the ones that must be read as SQL to be reviewed properly, and expressing them through a builder obscures more than it helps. Using raw SQL there is expected, not a failure.

Migrations are generated from schema-as-code, committed, and applied on deploy. Never edited after being applied. See "Two connection strings" below for exactly how they're applied, which is not the same connection runtime queries use.

**Never PostgREST, never `supabase-js`, for data access.** Every query — reads and writes — goes through Drizzle over a direct Postgres connection. `supabase-js` appears in exactly one place in this codebase: the browser-side Realtime subscription (§8), a client-side websocket concern with no Drizzle equivalent. See `docs/CONTEXT.md` §5 for why this is the boundary that actually mattered, not the platform.

**No RLS on application data.** Every access path is server-side — a Server Component, a Server Action, or an `app/api/*` route handler — and authorization is a code-level check against the authenticated user, never a database policy. `realtime.messages` specifically is never RLS-gated either; the live-fill channel is public instead (§8), which is what a policy would otherwise exist to guard and doesn't need to here.

### Two connection strings

`packages/db` exposes two connection factories (`packages/db/client.ts`), because Supabase's pooler and its direct connection are not interchangeable, and the two ways to get this wrong both fail silently rather than loudly:

- **`dbPooled()` — runtime queries.** Connects through Supabase's transaction-mode pooler (port 6543, `DATABASE_URL`). Sets `prepare: false`, because the pooler does not support prepared statements and Drizzle's postgres-js driver uses them by default — **omit this and every query works against a local or direct connection, then fails once deployed to Vercel.** This is the single most common way to ship this wrong, precisely because it's invisible until production traffic actually reaches the pooler. Also sets `max: 1`: one connection per serverless function invocation, because an unbounded pool per invocation is how a burst of concurrent Vercel functions exhausts the pooler's own connection budget before a single user notices anything is wrong — see the load-testing gate in §12.

- **`dbDirect()` — migrations and one-off scripts** (`drizzle-kit migrate`, `pnpm db:seed`). Connects straight to Postgres (port 5432, `DIRECT_URL`), bypassing the pooler entirely. A migration runs as a multi-statement transaction, which transaction-mode pooling does not support. **Run migrations from a local machine or CI, never from the Vercel build** — the build only ever has `DATABASE_URL` (the pooler) available, and a migration running as part of a build that concurrent requests might be hitting is its own hazard regardless.

Locally there is no pooler — `packages/db/docker-compose.yml` is one plain Postgres container — so `DATABASE_URL` and `DIRECT_URL` point at the same place (see `.env.local.example`). They only diverge in `.env.production`, a **separate, never-committed file from `.env.local`** — see `CLAUDE.md` → "Environment files" for the full split and the guard that backs it up; a script pointed at the wrong one refuses outright rather than silently reaching the wrong database.

Call the relevant factory once per request in Next.js code — inside the Server Component, Server Action or route handler that needs it — never as a module-level singleton reused across invocations. That would defeat the point of `max: 1` above.

### Schema conventions

`DOMAIN-MODEL.md` specifies tables and columns. It deliberately does not specify types, keys or constraints — those live here, so they are decided once rather than guessed per table.

**Primary keys: `uuid primary key default uuidv7()`.** Native in Postgres 18, no extension needed. Time-ordered, so B-tree locality is good and index bloat is low, while still being non-enumerable in URLs. Registration and claim IDs appear in links, and sequential integers would let anyone count the league or guess neighbours.

Caveat, accepted: a UUIDv7 leaks its creation time. For a registration or a claim that is harmless — the creation time is already visible to the person who made it.

**`uuidv7()` compatibility shim, `packages/db/migrations/0000_uuidv7_shim.sql`.** The convention above is correct and unchanged — this is the gap between deciding it and Supabase actually shipping Postgres 18. Confirmed against the real project (August 2026): Supabase Postgres is 17.6, which has no `uuidv7()` at all, so every table's PK default would fail on first use without this.

The shim is a pure-SQL, RFC 9562 §5.7-compliant implementation (`gen_random_bytes` for randomness, `overlay` to place a 48-bit millisecond timestamp, explicit version/variant bits) — not a rewrite of the convention, a stand-in for the one function it depends on. It's guarded with `to_regprocedure('uuidv7()')`, the same name resolution `_columns.ts`'s `default(sql\`uuidv7()\`)` uses, so it only ever creates itself where nothing already answers to that name. **The moment Supabase ships Postgres 18, this migration becomes a no-op** — the guard will find the real built-in and skip creating the shim. At that point the shim function can be dropped outright (`drop function if exists public.uuidv7();`, in a follow-up migration) — nothing else references it by name or behaviour, since every table's default is just the string `uuidv7()`, indifferent to which implementation answers it.

Verified with generated data, not by inspection: 5,000 values against a real Postgres 17 container (all unique, all version 7, all variant correct, embedded timestamp within ~1ms of wall-clock, zero ordering violations grouped by millisecond) and the same suite against Postgres 18's native builtin for comparison, confirming the shim and the built-in are behaviourally identical from the schema's point of view.

**Timestamps: always `timestamptz`, never `timestamp`.** The whole system turns on deadlines — `release_at`, `hold_expires_at`, `offer_expires_at`, `closes_at`. A naive timestamp during a Dutch daylight-saving transition would silently shift a release deadline by an hour. Every table gets `created_at timestamptz not null default now()`.

**Money: signed `integer` cents.** Never `numeric`, never `float`. Already reflected in the `_cents` column naming.

**Status columns: `text` plus a `CHECK` constraint, not Postgres `enum` types.** Statuses in this model will change — registration and claim states especially. Postgres enums can be appended to but not reordered or removed without a rewrite, and Drizzle migrations across enum changes are unpleasant. A check constraint gives the same safety and is trivial to alter.

**Foreign keys: every one declares its `on delete` behaviour explicitly.** Default to `restrict`. **Never `cascade` on anything touching money or history** — `ledger_entries`, `payments`, `registrations`, `claims`, `attendances`. Deleting a person must fail loudly while they have financial history rather than silently erasing it. Lookup and join tables (`slot_levels`, `poll_options`) may cascade.

**Columns are `not null` unless nullability is a deliberate modelled decision**, and where it is, the domain model says so (`guardian_id`, `cart_id`, `superseded_by_id`).

**Unique constraints wherever the domain implies uniqueness**, per invariant §4.4. Non-obvious cases:

- `levels (name)` and `levels (rank)` — two levels at the same rank makes ordering ambiguous
- `slot_capacities (slot_id, position)` and `ice_session_capacities (ice_session_id, position)` — one capacity row per position, and this is the row every claim locks
- `payments (mollie_payment_id)` — the idempotency key for webhook retries
- `attendances (registration_id, ice_session_id)`
- `poll_votes (poll_id, person_id)`
- The partial unique index on `registrations` in §4.4

**Check constraints for cheap domain invariants:** capacities non-negative, `ideal_capacity <= capacity`, prices non-negative, `rank > 0`, session `end_at > start_at`.

**Naming:** `snake_case` throughout, plural table names, singular foreign keys (`person_id`).

**Migrations:** always pass `--name` to `drizzle-kit generate`. Auto-generated names like `0000_nostalgic_mathemanic` are unreadable once there are twenty of them.

---

## 6. Jobs and schedules

No pg-boss, no worker process. Two different needs, two different mechanisms — pg-boss's `schedule()` and `send()` were always two things, just invisibly so behind one library.

**Schedule-based jobs** have nothing to enqueue, because nothing "happened" to trigger them — they act on a time-based condition becoming true. Each is its own Vercel Cron endpoint under `app/api/cron/*`, querying the condition directly rather than waiting on a queued message:

| Job | Vercel Cron endpoint | Acts on |
|---|---|---|
| `attendance.remind` | `/api/cron/attendance-remind` | Per-player digest for the T−7d / T−3d / T−48h ladder |
| `attendance.resolve-release` | `/api/cron/attendance-resolve-release` | `unknown` rows past `release_at` |
| `registration.sweep-holds` | `/api/cron/sweep-holds` | Housekeeping only — availability never depends on this firing, per §4.2 |
| `session.digest-space` | `/api/cron/session-digest-space` | Weekly "space this week" |
| `poll.close` | `/api/cron/poll-close` | Polls past `closes_at` |

**Event-based jobs** are triggered by a specific write happening elsewhere — a decline, a session completing, anything that ends up owing someone a notification. These go through an **outbox table**, written inside the same transaction as the change that causes them:

```ts
async function declineAttendance(tx: Tx, input: DeclineInput): Promise<void> {
  // ... free the spot ...
  await tx.insert(outbox).values({
    kind: "registration.offer-next",
    payload: { sessionId, position },
  });
}
```

`outbox`: `id`, `kind` (text — dispatches to a handler; same polymorphic shape as `player_flags`/`notification_log`, one table rather than one per job kind), `payload` (jsonb), `created_at`, `processed_at` (nullable — null means pending), `attempts`, `last_error`.

A single Vercel Cron endpoint, `/api/cron/drain-outbox`, selects a batch of pending rows `FOR UPDATE SKIP LOCKED`, dispatches each by `kind`, and sets `processed_at` on success. A failure increments `attempts` and records `last_error`; past a threshold, a row is left unprocessed rather than retried forever — a dead letter, visible for someone to look at, not silently dropped. This preserves invariant §4.6 exactly: the outbox row and the change that caused it commit together or not at all, so a released spot nobody was told about is structurally impossible, regardless of which mechanism drains the row.

| Job | `outbox.kind` | Written by |
|---|---|---|
| `registration.offer-next` | `registration.offer-next` | Any transition that frees slot/position capacity |
| `coach.post-fees` | `coach.post-fees` | Session completion |
| `email.send` | `email.send` | Anything that owes a player or admin an email |
| `push.send` | `push.send` | Anything that owes a player or admin a push |

Email and push handlers stay idempotent, keyed against `notification_log`, exactly as before — that guarantee doesn't depend on which queue delivered the job.

### The real constraint: Vercel Cron's plan tier

Verified by web search, August 2026: **Vercel's Hobby plan caps cron jobs at two per project, no more often than once a day — a more-frequent schedule fails at deploy time, loudly, which is the one mercy here.** Pro allows unlimited cron jobs at per-minute cadence.

This is a real decision, not a formality. The schedule-based jobs above tolerate daily cadence without complaint. The outbox drain does not: a waitlist offer or a spot-open notification sitting for up to 24 hours defeats the "notify on the event, not on a fixed schedule" principle in `DOMAIN-MODEL.md` §11 outright — Hobby-tier cron would trade pg-boss's near-immediate dispatch for next-day dispatch, which isn't the same system on a cheaper queue, it's a materially worse one. **The outbox pattern needs Vercel Pro to deliver what §4.6 and `DOMAIN-MODEL.md` §11 actually promise.** If that cost isn't acceptable, the cadence commitment above needs renegotiating against the budget in `docs/CONTEXT.md` §4 deliberately, before launch — not discovered as a surprise once the drain endpoint is already deployed and running once a day.

**Not yet implemented.** No `outbox` table, no Cron endpoints and no job handlers exist in code as of this session — this section describes the intended shape for whichever later session builds the attendance/notification features that need it. Nothing today writes to an outbox that doesn't exist yet.

---

## 7. Auth

Supabase Auth, not hand-rolled. **Decided, not implemented — this section is a design for a later session to build, not a description of code that exists yet.**

This reverses the self-hosted plan's "own it, no third-party auth service" call, for the same reason the rest of the stack reverted (`docs/CONTEXT.md` §5): the failure mode that decision was written against — `users.id` diverging from the Supabase auth UID — was a symptom of PostgREST-generated tables assuming Supabase's own schema conventions, not of Supabase Auth itself. Used directly, with `auth.users` as the identity provider and `people` as this application's own profile table linked by a stored subject ID, that failure mode doesn't apply: nothing here treats `auth.users.id` as the implicit primary key of anything else.

**The `credentials` table design already anticipated this.** Per `DOMAIN-MODEL.md` §2, credentials are deliberately a separate table so "any dependent may eventually want their own login... promotion is an insert, never a data migration." That's exactly the shape Supabase Auth needs: a `credentials` row with `provider = 'supabase'` and `provider_subject = auth.users.id`, inserted on first sign-in or on dependent promotion. A dependent with no `credentials` row has no login — true whether or not Supabase Auth exists behind it.

**What a later session needs to build:**

- Server-side session handling via `@supabase/ssr` — Supabase Auth issues its own session (JWT + refresh token); `@supabase/ssr` is the App Router integration point (cookie read/write in middleware or a route handler). Verify current `@supabase/ssr` guidance at implementation time rather than trusting this paragraph's memory of it; it's one of the fastest-moving parts of Supabase's own SDK.
- The `credentials` insert on first sign-in and on dependent promotion, per `DOMAIN-MODEL.md` §2.
- Role gating (`admin` / `scheduler` / `coach` / `player`) as a server-side check against `roles` — Supabase Auth answers "who is this," not "what can they do here"; that's still this application's job, in code, matching §5's "no RLS on application data."
- Providers: password, Google, Apple — unchanged from the self-hosted plan, and natively supported by Supabase Auth. Apple is still required on iOS once any other third-party sign-in is offered.
- Email one-tap actions (confirm/decline via a link, no login) stay a **separate** mechanism from Supabase Auth sessions: signed, single-purpose, expiring tokens, valid for exactly one action. Supabase Auth is for logged-in sessions; this deliberately isn't that, and doesn't become that just because Auth exists now.
- Native: Supabase Auth's own refresh-token flow does what the self-hosted plan's hand-rolled "opaque refresh token exchanged for short-lived access tokens" was building from scratch — use it rather than reimplementing it.

Dependents have no credentials until promoted. Promotion is an insert into `credentials`, never a data migration — true regardless of which auth provider sits behind that table, and the one sentence in this section that didn't need to change.

---

## 8. Live fill data

Supabase Realtime, **broadcast from a database trigger**, on a **public** channel. Not `postgres_changes` — Supabase's own guidance is to avoid it for new applications, since it's single-threaded and re-authorizes per subscriber on every change, which doesn't scale the way a broadcast does. Not a private, RLS-gated channel either: see below.

A trigger function on the tables that affect capacity (`registrations`, `slot_capacities` — see `packages/db/migrations/0004_live_fill_broadcast.sql`) computes the aggregate fill for the affected slot and calls `realtime.send(payload, event, topic, private)`. The payload is the aggregate integers themselves — `{ skater: { taken, capacity }, goalie: { taken, capacity } }` — never a row diff and never per-user state. Topic is `slot-fill:<slotId>`, one channel per slot, so a client only subscribes to the hours it's actually showing.

**Public, not private (`private = false`).** The public/private flag on `realtime.send()` controls who may *subscribe* to a topic, not who may read the underlying rows — no data is exposed that a page render wouldn't already show. Public means no RLS policy on `realtime.messages` for this channel, at all. This is a direct fix for a previous attempt's specific failure: Realtime authorization requires the service to insert a probe row into `realtime.messages` and roll back the transaction to check it against RLS policy, which is exactly the debugging session `docs/CONTEXT.md` §5 describes losing a full session to. Fill counts are not secret, so there is nothing here for a policy to protect — the previous attempt was gating something that didn't need gating.

Client side, a `useLiveFill` hook (`apps/web/app/lib/use-live-fill.ts`) subscribes with `supabase-js`, updates on the `'fill'` broadcast event, and calls `removeChannel` on unmount without exception — leaked channels are the leading cause of hitting Realtime's connection limits, well before the January rush would otherwise stress it. This is the **only** use of `supabase-js` in this codebase; see §5.

**This cannot be exercised against local Docker Postgres.** `realtime.send()` only exists on a real Supabase project — plain Postgres (`packages/db/docker-compose.yml`) has no `realtime` schema at all. The migration is written to no-op safely there rather than fail (see its own header comment), but the live-fill path itself — trigger firing, broadcast arriving, hook updating — has not been exercised end to end anywhere in this codebase. That needs the real project.

On reconnect, clients re-fetch current counts rather than assuming continuity from where the stream dropped — unchanged from the original design, and still the right call regardless of transport.

### The one cacheable page, and the rule that protects it

Since the application takes over `summerice.nl` entirely, it also owns the **public schedule page** — the unauthenticated equivalent of what WordPress serves today. That is the only genuinely cacheable surface in the system, and it is also the page that shows live fill.

Those two facts fight each other. The rule: **fill counts are fetched client-side or streamed, never baked into a cached HTML response.** A cached fill number reproduces the original "site says a slot is open, form says it's locked" bug in a new location, and that bug is the reason this project exists.

Everything above the fill numbers on that page — schedule, levels, prices, copy — caches freely.

**Current implementation: the whole page is `export const dynamic = "force-dynamic"`** (`apps/web/app/page.tsx`) — the simple correct fix, and sufficient at this scale. It means the marketing content above the fill numbers is re-rendered per request too, even though nothing about it needs to be.

**Recorded option, not built:** a static shell with the fill list inside a `<Suspense>` boundary would let the marketing content cache while only the fill numbers stream in dynamically — Next's Partial Prerendering shape. This is a genuine refinement, not a requirement; the traffic this page sees does not currently justify the added complexity. If page-render cost or TTFB on the marketing content ever becomes a real problem, this is the first thing to reach for — not a reason to move the fill numbers back into a cached response.

---

## 9. Email

Postmark, called only from the `email.send` job.

- Production sends from `notify.summerice.nl` — a subdomain, so a bad day cannot damage the root domain Cas uses for real correspondence
- Preview deployments use a separate Postmark server (or sandbox/test mode) with no verified sending domain, never the real one. `summerice.club`, the self-hosted plan's dedicated staging subdomain, is gone along with the Compose staging stack it identified (§10) — Preview sharing Production's Supabase project (§10) is an accepted pre-launch risk already; a Preview deployment able to send real email through the production sender is a second, separate one worth closing regardless
- DKIM, SPF and DMARC on the subdomain. **Check the existing DMARC policy on `summerice.nl` before adding records** — an unaligned `p=reject` means mail disappears rather than degrades
- Ramp volume rather than blasting all ~350 interest-list addresses on day one

Projected steady-state volume is ~5,400/month against Postmark's 10,000 tier. Push adoption reduces it.

---

## 10. Infrastructure

### Hosting

Vercel, with `apps/web` as the Project's **Root Directory** — a Vercel Project setting made once when the project is created, not expressible in `vercel.json`. Vercel auto-detects the pnpm workspace at the repo root and installs from there before building the Root Directory, so the monorepo layout needs no special-casing. `apps/web/vercel.json` pins `framework: "nextjs"` explicitly and sets `regions: ["fra1"]` (Frankfurt) — see Database below for why.

### Database

Supabase Postgres. **Created**, region `eu-central-1` (Frankfurt) — next to Vercel's `fra1`, both the closest major region to Leiden, which matters directly for §12's connection-exhaustion risk: a shorter round trip means a connection is held for less time per query, exactly the resource `max: 1` (§5) is trying to conserve. Postgres **17.6** — confirmed directly, not assumed; see §5's `uuidv7()` shim for what that requires. The migration set is applied; see §5 for the connection strings actually in use, which come from the Supabase dashboard's Project Settings → Database and are not derived from each other or constructed by hand.

### Backups

Supabase Pro includes **daily backups, 7-day retention**, with no configuration required. **Point-in-time recovery is a separate paid add-on on top of Pro** — verified by web search, August 2026 — not bundled automatically the way the self-hosted plan's WAL archiving was "free" once the storage was already paid for. Default PITR retention is 7 days, extendable to 28 self-serve.

Decide deliberately whether daily backups alone are sufficient, or PITR is worth the add-on cost, before launch. Up to 24 hours of loss on daily-backup-only is, in January, several hundred paid registrations — unreconstructable, and the exact number the original WAL-archiving section existed to prevent. This is a budget decision against `docs/CONTEXT.md` §4, not a technical one; make it on purpose rather than by defaulting to whatever Pro happens to include out of the box.

### Environments

| Environment | Vercel | Supabase | Data |
|---|---|---|---|
| Development (local) | `next dev` — Vercel is not involved | `packages/db/docker-compose.yml`, plain Postgres, no Auth, no Realtime | seeded synthetic |
| Preview | automatic per-branch/PR deployment | the same project as Production, until there's a reason not to — see below | real, shared with Production |
| Production | the `main` branch deployment | the real project | real |

**Preview sharing Production's Supabase project is a deliberate pre-launch decision, not an oversight — revisit it before the November soft launch.** Preview deployments are free and automatic on Vercel; a separate Supabase project or branch per Preview costs more and adds setup, and pre-launch, with no real registrations or payments yet, sharing is the cheaper default. Once real money moves through the production database, a Preview deployment able to write to it is a risk worth paying to remove.

Local dev never touches Supabase — `packages/db/docker-compose.yml` (§3, §5) is a plain Postgres container with no Auth and no Realtime. This is also why §7 (Auth) and §8 (the live-fill broadcast) are things this repository's local workflow structurally cannot exercise, independent of how carefully the code around them is written.

### DNS

| Name | Points at |
|---|---|
| `summerice.nl`, `www` | Vercel — the existing WordPress install is removed, not left running alongside |
| `notify.summerice.nl` | Postmark — unaffected by the hosting change |
| Preview deployments | Vercel's own `*.vercel.app` URLs, generated automatically per branch/PR |

The self-hosted plan's `summerice.club` staging subdomain is dropped along with the Compose staging stack it pointed at. Preview deployments replace it at no extra DNS record and no extra cost.

### Secrets and environment variables

Vercel's own environment variable store, set per **Production**, **Preview** and **Development** independently — not a `.env` file on a host, because there is no host. ("Development" here is Vercel's own term for values pulled via `vercel env pull` for local use of the Vercel CLI; this repository's actual local workflow doesn't use that, and reads `.env.local` / `.env.production` at the repo root, plus `apps/web/.env.local` for the browser-exposed Supabase values — see `CLAUDE.md` → "Environment files" for the full split. Documented anyway, since Vercel's dashboard has the three-way split regardless of whether this repo currently exercises the third one.)

| Variable | Production | Preview | Development (Vercel CLI) |
|---|---|---|---|
| `POSTGRES_URL` (pooler) | prod Supabase — **the Supabase–Vercel integration's own name, not `DATABASE_URL`** | not set — Preview and Development scopes are deliberately left off the integration, see below | not set |
| `POSTGRES_URL_NON_POOLING` (direct) | prod Supabase — same integration | not set, same reason | not set |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | prod project URL | prod project URL — it's public, either works |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | prod anon key | prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | set once §7 (Auth) needs it | set once §7 needs it | not needed locally yet |

**Correction, discovered by an actual failed build rather than assumed:** an earlier draft of this table said Vercel exposes `DATABASE_URL` / `DIRECT_URL` directly. It doesn't — those are this repo's own local-convention names (`.env.local`, `.env.production`, see `CLAUDE.md` → "Environment files"). The Supabase–Vercel integration injects its own names, `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING`, and **does not honor a manual rename in the dashboard** — it resyncs on its own schedule and overwrites one. `packages/db/env.ts` resolves `DATABASE_URL`, falling back to `POSTGRES_URL`, and `DIRECT_URL`, falling back to `POSTGRES_URL_NON_POOLING` — local convention first, production integration name as the fallback, never the other way around.

**Preview and Development scopes are deliberately left off the integration**, not an oversight — see `CLAUDE.md` → "Environment files" for the full reasoning (the integration would sync the service role key and database password into those scopes, which Supabase itself advises against). Do not add `DATABASE_URL` / `DIRECT_URL` manually for those scopes either — same mistake, done by hand instead of by the integration. Consequence: **Production is currently the only environment with a working database connection** — Preview builds that touch the database will fail until feature branches plus Supabase Branching are set up (tracked in `CLAUDE.md` and §15), which is acceptable only pre-launch, with no real data at stake.

**`NEXT_PUBLIC_*` variables are inlined into the client bundle at build time — unavoidable, not a bug.** Everything else in the table above is read at runtime from `process.env` in server-only code and never reaches the client bundle. This is the resolution of the original bug list's "Vercel's build cache inlining stale environment variable values": verified by web search, August 2026, a `NEXT_PUBLIC_*` value really is compiled into the JS bundle at build time, and a redeploy that reuses Vercel's build cache reuses that stale compiled output rather than re-reading the new value. **After changing any `NEXT_PUBLIC_*` variable, redeploy without the existing build cache** — the dashboard's redeploy dialog has a checkbox for this, or `vercel --force` — otherwise the old value ships silently. "Never inline configuration at build time," the original rule, still holds without exception for every other variable; it's specifically the public ones that need this extra discipline instead of being exempt from the rule.

### Observability

- Vercel's own deployment and function-invocation logs, plus an `/api/health` route handler that touches the database (Supabase) and Postmark separately, so a partial outage is diagnosable without shell access — same principle as the self-hosted plan, aimed at a URL instead of a box.
- Uptime monitoring against `/api/health`, alerting **Cas's phone as well as Michael's** — an alert only Michael sees is a single point of failure during the one week that matters, unchanged from the original reasoning.
- Vercel Cron's own dashboard shows recent invocations and failures per job — the closest equivalent to the self-hosted plan's pg-boss dead-letter queue depth alerting. Outbox rows stuck unprocessed past their retry threshold (§6) still need their own alert; nothing surfaces those automatically just because Cron ran.
- Error tracking: **not yet decided.** The self-hosted plan's self-hosted GlitchTip assumed a box to run it on; that box is gone. A hosted option (Sentry or similar) is the natural replacement but hasn't been chosen — tracked as an open item (§15) rather than silently dropped.

---

## 11. Brand primitives

Sampled from the logo. Three colours, no more.

| Token | Hex | Notes |
|---|---|---|
| `brand-blue` | `#5CC8FF` | 61% of the logo. Same value attempt 1 used |
| `brand-yellow` | `#FFDD05` | 18% of the logo. Was absent from attempt 1 entirely |
| `brand-black` | `#000000` | 17% |

### This is a dark-background palette, by arithmetic

| Foreground | On white | On `#0E2235` |
|---|---|---|
| `#5CC8FF` | 1.88:1 — decorative only | 8.59:1 — passes AA |
| `#FFDD05` | 1.35:1 — decorative only | 12.01:1 — passes AA |

Neither brand colour is legible as text on white. Attempt 1 going dark was not a stylistic choice; it was the only way to use these colours as anything but decoration. Keep the dark direction.

### Unresolved: yellow collides with the warning state

Attempt 1's unconfirmed/amber status was `#EF9F27`, close enough to `#FFDD05` that brand yellow beside a yellow warning badge reads as one thing. One of them must move.

Recommendation: yellow belongs to the brand; the unconfirmed state moves to a clearly distinct amber or a neutral. To be settled during design, recorded here so it is not discovered late.

---

## 12. Testing

| Layer | Approach |
|---|---|
| `packages/core` | Integration tests against a real Postgres in Docker (`packages/db/docker-compose.yml`). No mocks — the behaviour under test *is* the database's |
| Concurrency | Dedicated load harness against local Postgres, see below |
| Pooler under load | A **second, later** load harness against the real Supabase project — see below. Local Docker has no pooler and can't stand in for this |
| Ledger | Adversarial property tests. Signed-amount ledgers are easy to get subtly wrong |
| Routes | Thin, so thin tests |
| Web UI | Vercel Preview deployments — a real, reachable, deployed environment per branch/PR, not a local-only preview build |

### The load test is a gate, not a nicety

A harness firing several hundred concurrent multi-line carts with overlapping slot sets at a 20-capacity slot, asserting:

- exactly 20 winners, never 21
- no partial baskets
- no deadlocks
- no duplicate registrations for one person on one slot and position

**This runs in September, against the schema and core only, before any UI exists.** If it does not hold, nothing downstream matters, and finding out in September leaves months rather than weeks. It runs against local Postgres (§3) and proves row-level locking and capacity correctness — it does not, and cannot, prove the Supabase pooler holds up, because local Postgres has no pooler and no connection cap to exhaust.

### Load testing against the real Supabase pooler — a second, later gate

**Required, not optional.** Reports exist of max-connection errors on Supabase's transaction-mode pooler at 300+ concurrent users, even with `prepare: false` set correctly (§5). January's registration rush is exactly this shape — a few hundred people, in a few days, hitting the same slot-capacity rows — and `max: 1` per function invocation (§5) is a mitigation, not a proof. It needs to be exercised under load against the real pooler, at a concurrency level matching or exceeding what January will actually produce, before it's trusted with real registrations and real money.

Run this once the Supabase project exists and the registration flow is built enough to exercise it — necessarily later than the September gate above, since it needs a real project and real code, but still completed **before** the January rush it exists to protect, not discovered during it.

---

## 13. Build order

| # | Phase | Target |
|---|---|---|
| 1 | ~~Vercel project + Supabase project~~ — done. Postgres 17.6, covered by the `uuidv7()` shim (§5); local Docker for dev unaffected either way | Sept |
| 2 | Schema and migrations from the domain model | Sept |
| 3 | **Concurrency core + load test, against local Postgres** | Sept — the real gate |
| 4 | Auth (Supabase Auth behind `credentials`), family accounts, roles | Oct |
| 5 | Ledger, Mollie, webhook | Oct |
| 6 | Registration flow, web | Oct |
| 7 | Admin: sessions, rosters, flags — mobile-first | Oct–Nov |
| 8 | Notifications: outbox table, Vercel Cron endpoints, digests, reminder ladder — confirm Vercel plan tier first (§6) | Nov |
| 9 | **Load test against the real Supabase pooler** | Nov, before soft launch — §12 |
| 10 | **Soft launch, web only** | Nov |
| 11 | Extras, claiming, polls, cancellations | Dec–Jan |
| 12 | Expo app | Feb–Mar |

Registration is built first and hardened because it carries the most money and gets its real trial in January, months before anything else is stressed. Nobody needs the app until extras claiming goes live in March.

---

## 14. Rejected, with reasons

Recorded so they are not quietly reintroduced. **This table changed shape this session** — Next.js, Supabase and Vercel were rejected in an earlier draft of this document and are adopted above instead; the self-hosted plan that replaced them is what's rejected now. See `docs/CONTEXT.md` §5 for the honest account of why the correction went this direction. What follows is current, not historical.

| Rejected | Why |
|---|---|
| Hetzner box, owned infrastructure | Traded for Vercel + Supabase. Operating a box, a reverse proxy and backups personally — on top of building the application solo, on a deadline — was over-engineering: it was protection against bugs that were actually PostgREST and RLS specifically, not the platform |
| Docker Compose in production, Caddy | Same reasoning as above — Vercel replaces both, and neither was the actual fix for the original bug list |
| pgBackRest + WAL archiving | Supabase Pro's daily backups (plus the PITR add-on, if warranted — §10) replace this, at the cost of a subscription instead of personal operational load |
| pg-boss, a worker process | Replaced by Vercel Cron + an outbox table (§6) — no process to operate, no image to keep from drifting |
| Hand-rolled auth | Replaced by Supabase Auth behind `credentials` (§7). The `users.id`-vs-UID bug it was written against was a PostgREST symptom — a table auto-exposed by PostgREST assuming its own ID conventions — not a problem with using an auth service as such |
| `LISTEN`/`NOTIFY` over SSE | Replaced by Supabase Realtime, broadcast from a trigger, on a public channel (§8). The RLS failure that motivated avoiding Realtime entirely is fixed by not using RLS, not by avoiding Realtime |
| PostgREST / `supabase-js` for data access | The row cap, the silent join failures, the UID-mismatch class of bug — all real, all specific to PostgREST, not to Supabase as a platform. Drizzle over a direct connection instead (§5) |
| `postgres_changes` (Supabase Realtime) | Single-threaded, re-authorizes per subscriber on every change — Supabase's own guidance is to avoid it for new applications. Broadcast from a trigger instead (§8) |
| Private Realtime channels / RLS on `realtime.messages` | The specific mechanism that cost a previous attempt a full debugging session (§10, `docs/CONTEXT.md` §5). Fill counts aren't secret, so a public channel needs no policy at all |
| Vercel Edge Runtime, for anything touching the database | Edge Functions can't hold a raw TCP connection — no `postgres` (postgres-js), no direct Postgres access, full stop. Every route handler or Server Component doing database work runs on the Node.js serverless runtime (Vercel's default), never Edge |
| `pg_net` | Vercel stripped its `Authorization` header in a previous attempt, forcing a custom secret over HTTP. Vercel Cron calling a route handler directly needs no database-initiated HTTP call at all (§6) |
| SvelteKit | No shared TypeScript core with Expo |
| Rails 8 | Same — excellent fit otherwise |
| Redis / BullMQ | Another service to run for volume Postgres handles trivially |
| Brevo free tier | 300/day cap breaks during January |
| Postmark dedicated IP | Requires 300k+/month and can hurt delivery below that |
| Shared React components across web and native | `react-native-web` overpromises |

---

## 15. Open items

Tracked here rather than in conversation, because several have long lead times.

| Item | Owner | Blocks | Notes |
|---|---|---|---|
| Apple Developer enrolment under Cas's KVK | Cas | Phase 12 only | Organisation accounts need a D-U-N-S number; lookup plus Apple verification routinely runs 2–4 weeks. Start well before February. Account belongs to the league, not to Michael. |
| Read the existing DMARC record on `summerice.nl` | Michael | Phase 8 | An unaligned `p=reject` at switchover means mail disappears rather than degrades |
| Confirm App Review treats ice time as a real-world service, outside IAP | Michael | Phase 12 | Same category as a gym class or event ticket, but review is inconsistent enough to confirm early rather than discover in a rejection |
| Yellow versus amber status collision | design pass | Phase 6 | See §11 |
| Expo SDK exact version | at install | Phase 12 | See §2 |
| WordPress removal and DNS cutover sequencing | Michael + Cas | Phase 10 | Decide whether the app goes live on a subdomain first or cuts over directly |
| Drop the `uuidv7()` shim once Supabase ships Postgres 18 | Michael | none — cleanup only | `drop function if exists public.uuidv7();` in a follow-up migration. The shim's own guard already makes this optional rather than urgent — see §5 |
| Vercel plan tier — Hobby's cron limits (2 jobs, once-daily max) can't serve the outbox drain | Michael | Phase 8 | Needs Pro before the outbox pattern delivers near-real-time dispatch. Budget decision against `docs/CONTEXT.md` §4 — see §6 |
| Supabase Pro daily backups vs. the paid PITR add-on | Michael | Phase 1 (decide), before launch (act) | PITR isn't bundled with Pro — verified by web search, see §10. Same "several hundred unreconstructable January registrations" stakes as the original WAL-archiving section |
| Preview deployments sharing Production's Supabase project | Michael | Phase 10 | Fine pre-launch with no real data at stake; revisit once real registrations and payments exist — see §10 |
| Error tracking replacement for the retired self-hosted GlitchTip plan | Michael | none yet | Not chosen. Sentry or similar is the natural fit — see §10 |
