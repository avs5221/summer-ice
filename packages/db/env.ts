// Resolves the two connection strings this package needs, from one of two
// files depending on context — see CLAUDE.md → "Environment files" for the
// full story. Short version:
//
//   .env.local      — local Docker Postgres. Read by default, by every
//                      ordinary db:* script.
//   .env.production  — the real Supabase project. Read ONLY when
//                      SUMMERICE_ENV=production is set in the environment,
//                      which only the explicit *:prod script variants do.
//                      Never the default — see guard-host.ts, which every
//                      script that resolves a connection also runs before
//                      touching anything.
//
// In deployed environments (Vercel) these are injected directly into the
// process environment (project settings — see docs/ARCHITECTURE.md §10),
// so this file-loading fallback never fires there; it exists purely for
// local development and manually-run scripts, where pnpm sets cwd to
// packages/db, not the repo root where these files live.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

function envFileName(): ".env.local" | ".env.production" {
  return process.env.SUMMERICE_ENV === "production" ? ".env.production" : ".env.local";
}

function loadRootEnvFileOnce(): void {
  if (loaded) return;
  loaded = true;

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = join(thisDir, "..", "..", envFileName());
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
    const file = envFileName();
    throw new Error(
      `${name} is not set. Copy ${file}.example to ${file} at the repo root and ` +
        `fill it in (see CLAUDE.md → "Environment files"). ${name} is ${usedFor}.`,
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
