# Summer Ice — Architecture

**Status:** draft for review
**Companion to:** `DOMAIN-MODEL.md`, which defines *what* the system does. This document defines *how* it is built and deployed.

Every Claude Code session starts by reading both documents. `DOMAIN-MODEL.md` is authoritative on behaviour; this file is authoritative on structure. Where they appear to conflict, the domain model wins and this file is wrong.

---

## Why this stack, in one page

Two previous attempts stalled. Their combined bug list is worth reading as a single diagnosis rather than a set of tickets:

- PostgREST silently capping results at 1,000 rows regardless of `.limit()`
- `.eq('season_id')` failing silently on registrations, because the season is reached through slots
- `users.id` diverging from the Supabase auth UID
- Realtime failing on `realtime.messages` RLS until replaced by a public-channel broadcast trigger
- Vercel stripping the `Authorization` header from `pg_net`, forcing a custom `x-cron-secret`
- Vercel's build cache inlining stale environment variable values
- Six cron jobs split across `pg_cron` and edge functions, with correctness depending on a sweeper firing

Not one of those is about ice hockey. Every one is an artifact of an HTTP boundary between the application and its database, plus a serverless platform between the application and its scheduled work. The domain itself — atomic claiming, three-state attendance, an append-only ledger — is not hard.

This architecture deletes that category rather than fixing its members.

It is worth noticing that the result is **more conservative** than what it replaces, not less. Dropped: PostgREST, RLS, Supabase Auth, Supabase Realtime, edge functions, `pg_cron`, `pg_net`, Vercel's build pipeline, React Server Components. Added: a job queue. The component count goes down. It only looks like a dramatic change because it is a change in kind — from rented platform to owned box.

---

## 1. Shape of the system

One Postgres database, one Node application serving both a web UI and a JSON API, one worker process, one Linux box.

```
                 ┌─────────────────────────────┐
   browser ───►  │  web  (React Router v8)     │
                 │   loaders / actions         │──┐
   Expo app ──►  │   /api/* resource routes    │  │
                 └─────────────────────────────┘  │
                                                  ├──► packages/core
                 ┌─────────────────────────────┐  │    (domain logic)
   pg-boss  ───► │  worker                     │──┘         │
   schedules     │   jobs, email, digests      │            ▼
                 └─────────────────────────────┘      Postgres 18
                                                      (local socket)
```

Web and native are two clients of one API. The worker is a separate process running the same image. Nothing crosses an HTTP boundary to reach the database.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node 24.19.0 | v8 floor is 22.22 |
| Language | TypeScript 6.x, strict | ESM throughout. **Not** 7.x — see below |
| Web framework | React Router 8.3.0, framework mode | **Not** Next.js, **not** "Remix" |
| React | 19.2.8 | v8 floor is 19.2.7 |
| Build | Vite 8.2.1 | v8 framework mode requirement (floor is Vite 7) |
| Styling | Tailwind 4.3.3 | |
| Database | PostgreSQL 18 | Same host, unix socket |
| Query layer | Drizzle | Schema-as-code, generated migrations |
| Jobs | pg-boss 12.x | Postgres-backed, `SKIP LOCKED` |
| Native | Expo / React Native | Ships Feb–Mar, after web launch |
| Email | Postmark | Transactional only |
| Payments | Mollie | Live account already active |
| Reverse proxy | Caddy | Automatic TLS |
| Orchestration | Docker Compose | |
| Host | Hetzner CX33, Falkenstein or Nuremberg | 4 vCPU / 8 GB |

Pin exact versions at scaffold time and do not chase minors between September and December. React Router moved to annual majors with v9 targeted around May 2027, so v8 covers this build comfortably.

**Installed and verified, August 2026** (scaffold commit `53b4dbf`):

| Package | Version |
|---|---|
| react-router | 8.3.0 |
| react | 19.2.8 |
| vite | 8.2.1 |
| tailwindcss | 4.3.3 |
| typescript | 6.x — **not 7.x**, see below |

**TypeScript stays on the 6.x line.** TypeScript 7.0 went GA on 8 July 2026 as the Go-native port and is genuinely ~10x faster, but it ships without a public compiler API until 7.1, which means **typescript-eslint cannot run on it**. It also has incomplete project-reference `--build` support, no declaration emit, and diagnostics that do not yet match the classic compiler exactly. Linting and exact diagnostics matter more than compile speed on a repo this size, where a full check takes seconds either way. Microsoft runs a dual track with 6.x supported for compatibility, so this is a supported position rather than a dead end. Revisit once 7.1 ships the API and the ecosystem catches up.

**Not verified — check at install:** current Expo SDK, current Drizzle release, current pg-boss patch, current Postgres 18 point release.

### Build-step constraints

There is no compile step. `packages/*` export TypeScript source directly; `apps/web` goes through Vite, and `apps/worker` runs `.ts` via Node 24's native type stripping.

Type stripping **deletes** type annotations rather than compiling them, so it does not support TS `enum`, `namespace`, or constructor parameter properties. Use union types and `const` objects instead. This constraint applies to `packages/core` and anything else the worker imports.

Formal TypeScript project references (`composite` + `references`) are not used; the graph is wired through path aliases plus `workspace:*` dependencies. Same import-by-name ergonomics without the emit conflict.

### Why not Next.js

Every authenticated page in this app is personalised and uncacheable, so RSC, ISR, edge middleware and the image CDN are unused weight. More decisively: with a native client, the JSON API is the product. Next.js would give RSC data fetching for web *and* a separate API for native — two data paths over one domain, maintained twice and drifting once. Loaders, actions and resource routes all calling one service layer is a single path.

### Version traps

- React Router v6 and Remix v2 are both End of Life as of June 2026. Do not install `remix` or `react-router-dom`; neither is the thing we want.
- Remix 3 is a separate Preact-based project with no React and no migration path. Ignore it entirely.
- v8 packages are ESM-only. Any dependency expecting CommonJS from React Router needs checking.
- v8 ships official docs inside `node_modules/react-router/docs`. Prefer those over recalled API knowledge.

---

## 3. Repository layout

pnpm workspaces.

```
summer-ice/
├── packages/
│   ├── core/           domain logic — framework-agnostic
│   ├── contracts/      Zod schemas, derived types, API client
│   └── db/             Drizzle schema, migrations, seed
├── apps/
│   ├── web/            React Router v8, framework mode
│   ├── worker/         pg-boss consumers and schedules
│   └── mobile/         Expo (phase 4)
├── infra/
│   ├── compose.yml
│   ├── Caddyfile
│   └── backup/         pgBackRest config
├── DOMAIN-MODEL.md
├── ARCHITECTURE.md
└── CLAUDE.md
```

`packages/contracts` is what makes web and native consistent. Schemas are defined once, types derived from them, and both clients use the generated API client. Components are **not** shared — `react-native-web` promises more than it delivers. Consistency comes from shared logic and shared tokens, not shared JSX.

---

## 4. Invariants

These are the rules that exist because previous attempts broke them. They are not stylistic preferences.

### 4.1 Domain logic lives in `packages/core` and takes a transaction handle

Every operation that touches capacity, money or state is a function in `packages/core` with the signature shape:

```ts
async function claimSpot(tx: Tx, input: ClaimInput): Promise<ClaimResult>
```

Loaders, actions, resource routes and jobs are thin callers. They parse input, call core, and render or serialise the result. **No domain logic in a route file, ever.**

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

pg-boss enqueues through the same connection, so releasing a spot and queueing its notification commit together or not at all. It must be structurally impossible to have a released spot nobody was told about.

This is the specific failure that made the previous `notify-drops` fragile, and it is designed out rather than coded around.

### 4.7 Display and notification count availability differently, on purpose

The number shown on a page **includes** pending holds — otherwise a player races for a spot already in someone's checkout. The `spot_open` notification trigger **excludes** them — otherwise an abandoned checkout re-announces a spot that never moved.

Same rows, two derived values, two jobs. Do not "fix" the inconsistency.

### 4.8 Money is append-only

`ledger_entries` are never updated and never deleted. Corrections are new offsetting entries. Balance is `SUM(amount_cents)` per person. Positive means the person owes the league; negative means the league owes them, which is how coach payables share the table.

---

## 5. Data access

Drizzle for schema, migrations and ordinary queries. Raw SQL via Drizzle's escape hatch for the capacity and availability queries — those are the ones that must be read as SQL to be reviewed properly, and expressing them through a builder obscures more than it helps. Using raw SQL there is expected, not a failure.

Migrations are generated from schema-as-code, committed, and applied on deploy. Never edited after being applied.

One connection pool for the web app, a separate one for the worker.

### Schema conventions

`DOMAIN-MODEL.md` specifies tables and columns. It deliberately does not specify types, keys or constraints — those live here, so they are decided once rather than guessed per table.

**Primary keys: `uuid primary key default uuidv7()`.** Native in Postgres 18, no extension needed. Time-ordered, so B-tree locality is good and index bloat is low, while still being non-enumerable in URLs. Registration and claim IDs appear in links, and sequential integers would let anyone count the league or guess neighbours.

Caveat, accepted: a UUIDv7 leaks its creation time. For a registration or a claim that is harmless — the creation time is already visible to the person who made it.

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

All scheduled work is pg-boss. There is no `pg_cron`, no `pg_net`, no edge function, and no secret travelling over HTTP to authenticate a cron call.

| Job | Trigger |
|---|---|
| `attendance.remind` | Schedule — builds per-player digests for the T−7d / T−3d / T−48h ladder |
| `attendance.resolve-release` | Schedule — resolves `unknown` to out at `release_at` |
| `registration.sweep-holds` | Schedule — housekeeping only |
| `registration.offer-next` | Event — waitlist promotion |
| `session.digest-space` | Schedule — weekly "space this week" |
| `poll.close` | Schedule |
| `coach.post-fees` | Event — session completion |
| `email.send` | Event — the only thing that talks to Postmark |
| `push.send` | Event |

Every queue gets `retryLimit`, `retryBackoff` and a dead-letter queue. Email and push handlers are idempotent, keyed against `notification_log`.

---

## 7. Auth

Own it. No third-party auth service.

- `people` + `credentials` + `sessions`, per `DOMAIN-MODEL.md` §2
- Web: signed HTTP-only session cookie
- Native: opaque refresh token exchanged for short-lived access tokens
- Providers: password, Google, Apple. Apple is required on iOS once any other third-party sign-in is offered.
- Role gating in React Router v8 middleware, which is enabled by default in v8
- Email one-tap actions use signed, single-purpose, expiring tokens — separate from session auth, and valid for exactly one action

Dependents have no credentials until promoted. Promotion is an insert into `credentials`, never a data migration.

---

## 8. Live fill data

Postgres `LISTEN`/`NOTIFY` → Server-Sent Events.

A trigger on the tables affecting occupancy notifies a channel per `(ice_session_id, position)`. One long-lived listener connection in the web process fans out to SSE subscribers.

Payload is aggregate integers only — never per-user state. That distinction is why this is thirty lines rather than the debugging saga it was last time.

> Note: this feature is a reason to avoid serverless Postgres. Transaction-mode pooling breaks `LISTEN`/`NOTIFY`, and a permanently held listener connection defeats scale-to-zero billing. An always-on local instance is the better fit.

On reconnect, clients re-fetch current counts rather than assuming continuity from where the stream dropped.

### The one cacheable page, and the rule that protects it

Since the application takes over `summerice.nl` entirely, it also owns the **public schedule page** — the unauthenticated equivalent of what WordPress serves today. That is the only genuinely cacheable surface in the system, and it is also the page that shows live fill.

Those two facts fight each other. The rule: **fill counts are fetched client-side or streamed, never baked into a cached HTML response.** A cached fill number reproduces the original "site says a slot is open, form says it's locked" bug in a new location, and that bug is the reason this project exists.

Everything above the fill numbers on that page — schedule, levels, prices, copy — caches freely.

---

## 9. Email

Postmark, called only from the `email.send` job.

- Production sends from `notify.summerice.nl` — a subdomain, so a bad day cannot damage the root domain Cas uses for real correspondence
- Staging sends from `summerice.club`, never crossed with production
- DKIM, SPF and DMARC on the subdomain. **Check the existing DMARC policy on `summerice.nl` before adding records** — an unaligned `p=reject` means mail disappears rather than degrades
- Ramp volume rather than blasting all ~350 interest-list addresses on day one

Projected steady-state volume is ~5,400/month against Postmark's 10,000 tier. Push adoption reduces it.

---

## 10. Infrastructure

### Host

Hetzner CX33, Falkenstein or Nuremberg. Stick to the CX (Intel-shared) or CAX (ARM) lines — the CPX and CCX lines were repriced 113–175% in June 2026 for dedicated cores this workload does not need. Rescaling an instance reprices it.

### Containers

`web`, `worker`, `postgres`, `caddy`. Web and worker run the same image with different entrypoints, so they cannot drift.

### Backups — WAL archiving, not just dumps

pgBackRest to a Hetzner Storage Box BX11, with:

- Full backup weekly, incremental daily
- **Continuous WAL archiving**, giving point-in-time recovery to the minute
- A **restore test** run weekly against the staging database, automated and alerting on failure

Nightly `pg_dump` alone means up to 24 hours of loss. In January that is several hundred paid registrations, unreconstructable. WAL archiving costs nothing beyond storage already paid for and closes the worst gap in the plan.

### Environments

| Environment | Where | Data |
|---|---|---|
| local | developer machine, Compose | seeded synthetic |
| staging | second Compose stack on the same box until October, then its own CX23 | anonymised copy |
| production | primary box | real |

Staging sharing the box pre-launch is acceptable and free. It moves to its own instance before the load test, so a load test cannot take production down.

### DNS

| Name | Points at |
|---|---|
| `summerice.nl`, `www` | the application — the existing WordPress install is removed, not left running alongside |
| `notify.summerice.nl` | Postmark |
| `summerice.club` | staging |

### Secrets

A `.env` file on the host, read at runtime. Not in the image, not in the repository, and **never inlined at build time** — stale build-time environment values were one of the original bugs, and the fix is to never bake configuration into a build in the first place.

### Observability

- Uptime monitoring hitting an endpoint that actually touches the database, with alerts to **Cas's phone as well as Michael's**. An alert only Michael sees is a single point of failure during the one week that matters.
- `/health` reporting database, queue and Postmark reachability separately, so a partial outage is diagnosable without shell access
- Structured JSON logs to stdout, collected by Docker
- Self-hosted GlitchTip on the staging stack for error tracking
- pg-boss dead-letter queue depth alerting — a silently failing email job is the worst failure mode in the system

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
| `packages/core` | Integration tests against a real Postgres in Docker. No mocks — the behaviour under test *is* the database's |
| Concurrency | Dedicated load harness, see below |
| Ledger | Adversarial property tests. Signed-amount ledgers are easy to get subtly wrong |
| Routes | Thin, so thin tests |
| Web UI | Visual verification via preview server |

### The load test is a gate, not a nicety

A harness firing several hundred concurrent multi-line carts with overlapping slot sets at a 20-capacity slot, asserting:

- exactly 20 winners, never 21
- no partial baskets
- no deadlocks
- no duplicate registrations for one person on one slot and position

**This runs in September, against the schema and core only, before any UI exists.** If it does not hold, nothing downstream matters, and finding out in September leaves months rather than weeks.

---

## 13. Build order

| # | Phase | Target |
|---|---|---|
| 1 | Infra: box, Compose, Caddy, Postgres, pgBackRest + WAL | Sept |
| 2 | Schema and migrations from the domain model | Sept |
| 3 | **Concurrency core + load test** | Sept — the real gate |
| 4 | Auth, family accounts, roles | Oct |
| 5 | Ledger, Mollie, webhook | Oct |
| 6 | Registration flow, web | Oct |
| 7 | Admin: sessions, rosters, flags — mobile-first | Oct–Nov |
| 8 | Notifications: jobs, digests, reminder ladder | Nov |
| 9 | **Soft launch, web only** | Nov |
| 10 | Extras, claiming, polls, cancellations | Dec–Jan |
| 11 | Expo app | Feb–Mar |

Registration is built first and hardened because it carries the most money and gets its real trial in January, months before anything else is stressed. Nobody needs the app until extras claiming goes live in March.

---

## 14. Rejected, with reasons

Recorded so they are not quietly reintroduced.

| Rejected | Why |
|---|---|
| Next.js | Nothing cacheable; API is the product; two data paths |
| Supabase / PostgREST | Row caps, silent join failures, RLS complexity — the source of most previous bugs |
| Supabase Auth | `users.id` vs auth UID class of bug; own auth is ~200 lines |
| Supabase Realtime | `realtime.messages` RLS; `LISTEN`/`NOTIFY` is simpler on one box |
| Vercel | $20/month for RSC, ISR, edge and image CDN this app does not use |
| `pg_cron` + `pg_net` | Header stripping, secrets over HTTP, non-transactional enqueue |
| Edge functions | Version juggling, cold starts, no transactional enqueue |
| Serverless Postgres | Pooling breaks `LISTEN`/`NOTIFY`; held listener defeats scale-to-zero |
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
| Apple Developer enrolment under Cas's KVK | Cas | Phase 11 only | Organisation accounts need a D-U-N-S number; lookup plus Apple verification routinely runs 2–4 weeks. Start well before February. Account belongs to the league, not to Michael. |
| Read the existing DMARC record on `summerice.nl` | Michael | Phase 8 | An unaligned `p=reject` at switchover means mail disappears rather than degrades |
| Confirm App Review treats ice time as a real-world service, outside IAP | Michael | Phase 11 | Same category as a gym class or event ticket, but review is inconsistent enough to confirm early rather than discover in a rejection |
| Yellow versus amber status collision | design pass | Phase 6 | See §11 |
| Expo SDK / Drizzle / pg-boss exact versions | at install | Phase 1 | See §2 |
| WordPress removal and DNS cutover sequencing | Michael + Cas | Phase 9 | Decide whether the app goes live on a subdomain first or cuts over directly |
