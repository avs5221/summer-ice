# @summerice/web

Next.js App Router app — web UI and (eventually) the `/api/*` route handlers
that will also serve the mobile client. See the repo root `CLAUDE.md` and
`docs/ARCHITECTURE.md` before making changes.

## Development

From the repo root:

```bash
pnpm dev:web
```

or from this directory:

```bash
pnpm dev
```

`pnpm install` at the repo root runs `next typegen` via this package's
`postinstall`-triggered `typegen` script, generating the route types under
`.next/types` that the root `tsc --noEmit` and this app's own build depend on.

## Environment variables

Every other package in this monorepo reads `.env.local` or `.env.production`
at the repo root (see `packages/db/env.ts` and CLAUDE.md → "Environment
files"). Next.js doesn't: it only auto-loads `.env*` files from **this**
directory. So the two `NEXT_PUBLIC_SUPABASE_*` variables also need to exist
in `apps/web/.env.local` — **a different file from the repo-root one of the
same name**, gitignored, not committed — copy their values from the repo
root `.env.production.example` (these are the real Supabase project's
public values; `NEXT_PUBLIC_*` is safe to expose, see the comment in
`app/lib/supabase-client.ts`). Everything else (`DATABASE_URL`,
`DIRECT_URL`) stays root-only; nothing in this app reads them yet.
