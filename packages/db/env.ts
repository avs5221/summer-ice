// Resolves the two connection strings this package needs. See
// docs/ARCHITECTURE.md §5 ("Two connection strings") for the full story —
// short version:
//
//   DATABASE_URL — the Supabase transaction-mode pooler (port 6543).
//                   Runtime code uses this, via dbPooled() in client.ts.
//   DIRECT_URL   — the Supabase direct connection (port 5432).
//                   Migrations and one-off scripts use this, via
//                   dbDirect() in client.ts, because the pooler does not
//                   support the multi-statement transactions migrations
//                   require.
//
// Locally there is no pooler — packages/db/docker-compose.yml runs one
// plain Postgres container — so DATABASE_URL and DIRECT_URL point at the
// same place in .env. They only diverge once pointed at a real Supabase
// project.
//
// In production these are injected directly into the process environment
// (Vercel project settings — see docs/ARCHITECTURE.md §10). In local dev,
// though, drizzle-kit and this package's own scripts are invoked via `pnpm
// --filter @summerice/db run ...`, which sets cwd to packages/db — not the
// repo root where .env actually lives — so there's nothing there to
// auto-load it. This does a minimal, dependency-free load of the
// repo-root .env as a fallback, only for variables not already present in
// the environment. It still fails loudly below if a variable is absent
// from both places.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

function loadRootEnvFileOnce(): void {
  if (loaded) return;
  loaded = true;

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = join(thisDir, "..", "..", ".env");
  if (!existsSync(rootEnvPath)) return;

  for (const line of readFileSync(rootEnvPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name: "DATABASE_URL" | "DIRECT_URL", usedFor: string): string {
  loadRootEnvFileOnce();
  const url = process.env[name];
  if (!url) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env at the repo root and ` +
        `fill it in (see docs/ARCHITECTURE.md §5, "Two connection strings"). ` +
        `${name} is ${usedFor}.`,
    );
  }
  return url;
}

/** The pooled (transaction-mode) connection string — runtime queries. */
export function requirePooledUrl(): string {
  return requireEnv("DATABASE_URL", "the pooler connection runtime queries use");
}

/** The direct connection string — migrations and one-off scripts. */
export function requireDirectUrl(): string {
  return requireEnv("DIRECT_URL", "the direct connection migrations require");
}
