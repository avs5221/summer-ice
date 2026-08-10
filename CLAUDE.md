# Summer Ice

Summer Ice is the registration, attendance, extras-claiming and payment platform for a
summer ice hockey league in Leiden: Supabase (Postgres, auth) and Vercel (Next.js app,
cron), not a hand-run box. It replaces a stack of Jotform, manual spreadsheets and
WhatsApp threads with atomic claiming, three-state attendance and an append-only
financial ledger, built to survive a January registration rush where demand exceeds
supply and money is on the line from the first minute.

Chosen because Supabase's own documentation, quickstarts and `@supabase/ssr` guidance are
Next-first, and this project is built by a solo developer working through an agent —
documentation density matters more here than framework preference.

## Start every session here

Read **`docs/DOMAIN-MODEL.md`** and **`docs/ARCHITECTURE.md`** in full before making changes.
`DOMAIN-MODEL.md` defines *what* the system does; `ARCHITECTURE.md` defines *how* it is
built and deployed.

**Where they conflict: `DOMAIN-MODEL.md` wins on behaviour, `ARCHITECTURE.md` wins on
structure.** If a route file's shape and a data rule seem to disagree, structure questions
(where code lives, what talks to what) defer to the architecture doc; behaviour questions
(what the system should actually do) defer to the domain model.

## Repository layout

```
summer-ice/
├── packages/
│   ├── core/           domain logic — framework-agnostic, takes a tx handle
│   ├── contracts/      Zod schemas, derived types, API client
│   └── db/             Drizzle schema, migrations, seed
├── apps/
│   ├── web/             Next.js App Router — server components fetch, client
│   │                     components handle interaction, app/api/* route
│   │                     handlers are the API surface for the future mobile client
│   └── mobile/           Expo — phase 4, not scaffolded yet
├── docs/
│   ├── DOMAIN-MODEL.md
│   └── ARCHITECTURE.md
└── .claude/rules/        path-scoped rules derived from ARCHITECTURE.md §4
```

There is no `apps/worker` and no `infra/` any more. Scheduled and background work
(reminder ladders, hold sweeps, waitlist offers) moves to Vercel Cron endpoints under
`apps/web/app/api/*` in a later session — there is no long-running worker process.

Packages are consumed as workspace dependencies by name (`@summerice/core`,
`@summerice/contracts`, `@summerice/db`) — no build step, no compiled output. Each
package's `package.json` points `main`/`types` straight at its `index.ts`, and matching
path aliases in the root and `apps/web` tsconfigs make the same imports resolve for the
type checker. `apps/web` compiles its TypeScript itself, via Next's own SWC-based
toolchain, rather than compiling packages to `dist/` first.

Note on TypeScript project references (re-verified against TypeScript 6.0.3, not a
TS7-only limitation): real composite project references assume a multi-step build graph —
`tsc -b` compiles each referenced project and downstream projects consume its emitted
`.d.ts`, they don't re-read its `.ts` source directly. Our root `tsconfig.json` instead
puts every app and package's source `.ts`/`.tsx` files into one flat `include` so a single
`tsc --noEmit` genuinely checks the whole repo in one pass (a solution-style root with only
`references` and no `include` type-checks nothing at all under plain `tsc` — it's a silent
no-op unless invoked with `-b`, which we don't want to require). Once source files a
composite project owns are pulled into a second, non-`-b` program via a raw `include`
glob, `tsc` correctly refuses (`TS6305`, "output file has not been built from source
file") because that file's declaration output doesn't exist yet in that graph. The two
strategies are mutually exclusive for the same files, not merely inconvenient together.
Since nothing here consumes compiled `.d.ts` output anyway, the wiring below intentionally
skips composite references in favor of path aliases + workspace `package.json`
dependencies, which give the same "import by name" ergonomics without requiring a build
step or a `-b` invocation.

## Environment files

**Two separate files, both at the repo root, neither committed: `.env.local` and
`.env.production`.** This split exists because a single shared `.env` once let a
local-only command resolve straight through to the real Supabase database — nothing
technical stopped it, only the assumption that "the db scripts are for local dev" held.
That assumption broke the first time `.env`'s values were updated to real Supabase
credentials for a verification task. Read this section before touching any `db:*` script,
`packages/db/env.ts`, or `packages/db/guard-host.ts` — the mechanism below is why that
mistake cannot recur silently, and undoing any part of it defeats the point.

| File | Committed? | Read by | Contents |
|---|---|---|---|
| `.env.local` | No — `.env.local.example` is | Every ordinary `db:*` script, by default | Local Docker Postgres only (`packages/db/docker-compose.yml`, port 5433) |
| `.env.production` | No — `.env.production.example` is | Only `*:prod` script variants, via `SUMMERICE_ENV=production` | The real Supabase project |

`packages/db/env.ts` picks between them based on `process.env.SUMMERICE_ENV` — `"production"`
loads `.env.production`, anything else (including unset) loads `.env.local`. **Local is the
default in every case.** Reaching production requires deliberately setting that variable,
which only the `:prod` scripts do.

**`POSTGRES_PASSWORD` in `.env.local` must be a value that has never been the Supabase
database password**, not a coincidence of both files once being copy-pasted from the same
place. It's what makes the local Docker container structurally incapable of being confused
for the real database, on top of the host check below.

### The host guard — a hard exit, not a warning

Every script above also runs `packages/db/guard-host.ts <local-only|remote-required>` before
doing anything else. It resolves the connection string exactly as the real command would,
extracts the hostname, and:

- **`local-only`** (the default for `generate`, `migrate`, `seed`, `studio`, and `db:nuke`)
  — refuses unless the host is `localhost` or `127.0.0.1`. Anything else exits 1 with the
  resolved host named in the message, before a single query runs.
- **`remote-required`** (`migrate:prod`, `health:realtime`) — refuses if the host *is*
  local. Catches the opposite mistake: running a "prod" command against a stale or
  misconfigured `.env.production` that happens to point at nothing in particular.

This is deliberately redundant with the file split above — the guard checks the *resolved*
host regardless of which file supplied it, so a mistake in either layer (wrong file loaded,
or the right file with a wrong value in it) still gets caught. Neither layer alone was
trusted to be enough.

`db:nuke` gets the guard even though `docker compose down --volumes` never reads
`DATABASE_URL`/`DIRECT_URL` at all — it only ever operates on the local Compose project
named in `packages/db/docker-compose.yml`, so it cannot structurally reach Supabase
regardless of what any `.env*` file contains. The guard there is belt-and-suspenders for
the single most irreversible command in this toolkit, not evidence that it was ever
actually at risk — don't remove it on the reasoning that it's "provably unnecessary."

### Running a migration against production

```bash
pnpm db:migrate:prod
```

Requires `.env.production` to exist and resolve to a real remote host — the guard checks
this before `drizzle-kit migrate` ever runs. There is no flag or shortcut that skips it, on
purpose. If the guard refuses and the target genuinely is production, the fix is to check
`.env.production` itself, not to bypass the check.

### `apps/web/.env.local` is a different file

Next.js auto-loads `.env*` files from `apps/web/`, not the repo root — so
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` also need to exist in
`apps/web/.env.local`, which is unrelated to the root file of the same name despite sharing
a filename. See `apps/web/README.md` and `apps/web/app/lib/supabase-client.ts`.

### Vercel doesn't use these names at all

`DATABASE_URL` and `DIRECT_URL` are this repo's own local convention — nothing on Vercel is
named that. The Supabase–Vercel integration injects its own names into the Vercel
environment: **`POSTGRES_URL`** (pooled, the `DATABASE_URL` equivalent) and
**`POSTGRES_URL_NON_POOLING`** (direct, the `DIRECT_URL` equivalent). This caused a real
build failure (`Error: DATABASE_URL is not set`) before `packages/db/env.ts` learned to fall
back to the integration's names when the local-convention name isn't set. **Never rename
`POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` in the Vercel dashboard** to match the local
convention — the integration resyncs on its own schedule and silently overwrites a manual
rename back to its own names, so "fixing" it that way doesn't stay fixed.

**Preview and Development scopes in Vercel are deliberately left OFF the integration.**
Turning them on would sync production credentials — including the service role key and the
database password — into those scopes, which Supabase's own guidance advises against. Don't
add `DATABASE_URL` / `DIRECT_URL` manually for those scopes either as a workaround; that's
the identical mistake made by hand instead of by the integration.

**Consequence: Production is currently the only environment with a working database
connection** — Preview deployments have no database credentials at all right now, so
anything in `apps/web` that reads the database will fail there, not just on Vercel's build.
This is acceptable *only* because there is no real data yet. Before January registration
opens, this needs feature branches plus Supabase Branching, so each Preview deployment gets
its own isolated per-branch credentials instead of either sharing production's or having
none. See `docs/ARCHITECTURE.md` §10 and §15.

### `git push` is the actual deploy trigger

Vercel builds on push, not on commit. Claude Code commits locally but does not push —
pushing to `origin` is a deliberate step the human takes at the end of a session, not
something to do unprompted. This matters here specifically because unpushed commits are
invisible to Vercel: seven commits once accumulated locally, unpushed, across several
sessions, which meant Vercel kept rebuilding and redeploying a stale commit for days while
newer local work sat unseen. If a Vercel deployment looks stale, check `git log` against
`git log origin/main` before assuming the build itself is broken.

## TypeScript

**Always run `npx tsc --noEmit` from the repo root — project-wide — never against an
individual file or a single package.** The root `tsconfig.json` includes every app and
package in one program; that single invocation is the only one that reflects whether the
whole repo actually type-checks. Unlike the old React Router setup, the root check does
**not** depend on generated route types: pages type their own `params`/`props` by hand
(`params: Promise<{ id: string }>`, per Next's App Router convention) rather than
importing a generated `./+types/*` module, so `tsc --noEmit` passes even with no `.next/`
directory present at all.

`pnpm install` still regenerates `apps/web`'s route types via `postinstall` → `next
typegen` (Next's equivalent of the old `react-router typegen`), and `next dev` / `next
build` regenerate the same output under `apps/web/.next/types` on every run. That output
feeds Next's own internal build-time type check and editor tooling, not the root `tsc`
pass — keep it running via `pnpm install` regardless, since `apps/web`'s own `typecheck`
script and `next build` both still need it.

## Rules

See `.claude/rules/` for path-scoped rules on capacity locking, availability computation,
route-file boundaries and ledger append-only-ness. They encode invariants from
`ARCHITECTURE.md` §4 that previous attempts at this system broke.
