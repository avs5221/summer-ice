# Summer Ice

Summer Ice is the registration, attendance, extras-claiming and payment platform for a
summer ice hockey league in Leiden: one Postgres database, one Node application serving
both a web UI and a JSON API, one worker process, one Linux box. It replaces a stack of
Jotform, manual spreadsheets and WhatsApp threads with atomic claiming, three-state
attendance and an append-only financial ledger, built to survive a January registration
rush where demand exceeds supply and money is on the line from the first minute.

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
│   ├── web/             React Router v8, framework mode (loaders/actions + /api/* resource routes)
│   ├── worker/           pg-boss consumers and schedules (skeleton — no jobs yet)
│   └── mobile/           Expo — phase 4, not scaffolded yet
├── infra/                Compose, Caddyfile, pgBackRest — not scaffolded yet
├── docs/
│   ├── DOMAIN-MODEL.md
│   └── ARCHITECTURE.md
└── .claude/rules/        path-scoped rules derived from ARCHITECTURE.md §4
```

Packages are consumed as workspace dependencies by name (`@summerice/core`,
`@summerice/contracts`, `@summerice/db`) — no build step, no compiled output. Each
package's `package.json` points `main`/`types` straight at its `index.ts`, and matching
path aliases in the root and `apps/web` tsconfigs make the same imports resolve for the
type checker. Apps run their TypeScript directly (Node 24's native type stripping for the
worker, Vite for web) rather than compiling packages to `dist/` first.

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
whole repo actually type-checks. `pnpm install` regenerates `apps/web`'s React Router
route types (`postinstall` → `react-router typegen`) that the root check depends on — if
`tsc` reports a route file's `./+types/*` import as missing, run `pnpm install` again
rather than chasing it as a real error.

## apps/worker runs TypeScript directly — no enums, namespaces, or parameter properties

`apps/worker` executes `.ts` files straight through Node 24's built-in type stripping
(`node src/index.ts`, no build step, no `tsx`/`ts-node`). Type stripping is *erasure*, not
compilation — it deletes type syntax and runs what's left, and never evaluates types. That
rules out any TypeScript construct that isn't pure erasable syntax:

- **No `enum`** (including `const enum`) — it compiles to real runtime code, not just
  types. Use a union of string literals, or a `const` object with `as const`.
- **No `namespace`/`module` blocks** with runtime members.
- **No constructor parameter properties** (`constructor(private x: number)`) — they
  expand into assignment statements the stripper won't generate. Declare the field and
  assign it in the constructor body instead.

This applies to any module the worker imports, transitively — including everything in
`packages/core`, `packages/contracts` and `packages/db`. Those packages are consumed by
`apps/web` too (via Vite, which *does* compile), so this constraint is the tighter of the
two and effectively governs the shared packages: write them as if Node's stripper will run
them directly, even where a given file happens to load through Vite instead.

## Rules

See `.claude/rules/` for path-scoped rules on capacity locking, availability computation,
route-file boundaries and ledger append-only-ness. They encode invariants from
`ARCHITECTURE.md` §4 that previous attempts at this system broke.
