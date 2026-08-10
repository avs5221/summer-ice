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

Every other package in this monorepo reads the single `.env` at the repo
root (see `packages/db/env.ts`). Next.js doesn't: it only auto-loads `.env*`
files from **this** directory. So the two `NEXT_PUBLIC_SUPABASE_*` variables
also need to exist in `apps/web/.env.local` (gitignored, not committed) —
copy their values from the repo root `.env.example`. Everything else
(`DATABASE_URL`, `DIRECT_URL`) stays root-only; nothing in this app reads
them yet.
