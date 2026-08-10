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
