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
