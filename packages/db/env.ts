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
//
// Production variable names — the Supabase–Vercel integration, not this repo
// ----------------------------------------------------------------------
// The Supabase–Vercel integration auto-injects its own env var names into
// Vercel — POSTGRES_URL (pooled) and POSTGRES_URL_NON_POOLING (direct) — not
// DATABASE_URL / DIRECT_URL, which is this repo's own local convention (see
// CLAUDE.md). Renaming them in the Vercel dashboard is not an option: the
// integration resyncs on its own schedule and overwrites a manual rename
// silently. So resolution here checks the local names FIRST, then falls
// back to the integration's names — this is a production-only fallback, not
// a change to the local convention: .env.local keeps using DATABASE_URL and
// DIRECT_URL, and those are always found first wherever they're set.
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

// Names every variable checked for EITHER connection, so a failure message
// gives the full picture regardless of which resolution failed — a future
// session staring at one stack trace shouldn't have to go find this comment
// to learn there are four names in play, not one.
const POOLED_NAMES = ["DATABASE_URL", "POSTGRES_URL"] as const;
const DIRECT_NAMES = ["DIRECT_URL", "POSTGRES_URL_NON_POOLING"] as const;

function missingEnvMessage(usedFor: string): string {
  const file = envFileName();
  return (
    `Neither of the pooled connection names (${POOLED_NAMES.join(", ")}) nor either of ` +
    `the direct connection names (${DIRECT_NAMES.join(", ")}) resolved a value — ${usedFor}. ` +
    `Locally: copy ${file}.example to ${file} at the repo root and fill it in (DATABASE_URL / ` +
    `DIRECT_URL — see CLAUDE.md → "Environment files"). On Vercel: POSTGRES_URL / ` +
    `POSTGRES_URL_NON_POOLING come from the Supabase–Vercel integration and should already be ` +
    `set for this environment — check the integration is connected for this project and scope.`
  );
}

/** The pooled (transaction-mode) connection string — runtime queries.
 *  DATABASE_URL locally, falling back to POSTGRES_URL — the name the
 *  Supabase–Vercel integration injects in production. */
export function requirePooledUrl(): string {
  loadRootEnvFileOnce();
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(missingEnvMessage("the pooler connection runtime queries use"));
  }
  warnIfNotPoolerPort(url);
  return url;
}

/** The direct connection string — migrations and one-off scripts.
 *  DIRECT_URL locally, falling back to POSTGRES_URL_NON_POOLING — the name
 *  the Supabase–Vercel integration injects in production. */
export function requireDirectUrl(): string {
  loadRootEnvFileOnce();
  const url = process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    throw new Error(missingEnvMessage("the direct connection migrations require"));
  }
  return url;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

// Supabase's transaction-mode pooler is always port 6543. Port 5432 on a
// resolved pooled URL means the session pooler or a direct connection —
// either one accepts prepared statements and unbounded-feeling connection
// counts in a way the transaction pooler doesn't, which is exactly the
// connection-exhaustion risk docs/ARCHITECTURE.md §5 and §12 warn about
// under serverless concurrency (the January load-testing gate). A wrong
// port here is a real misconfiguration, but not one worth failing the
// build over by itself — dbPooled() still sets prepare:false and max:1
// regardless, so this is a loud warning, not a hard stop.
//
// Skipped for local hosts: local Docker is deliberately a single plain
// Postgres container with no pooler at all (§5 — DATABASE_URL and
// DIRECT_URL point at the same place locally), so it never has a 6543 to
// match, by design. Warning on that every single local run would make the
// warning noise rather than signal for the one case — a misconfigured
// production/Supabase URL — it actually exists to catch.
function warnIfNotPoolerPort(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return; // Malformed URL — dbPooled()'s own connection attempt will fail loudly enough.
  }
  if (LOCAL_HOSTS.has(parsed.hostname)) return;
  const port = parsed.port;
  if (port !== "6543") {
    console.warn(
      `[db/env] WARNING: the resolved pooled connection string uses port ${port || "(none — default 5432)"}, ` +
        `not 6543. Supabase's transaction-mode pooler is always 6543 — see docs/ARCHITECTURE.md §5. Port 5432 ` +
        `is the session pooler or a direct connection, which risks exhausting the connection budget under ` +
        `serverless concurrency (§12). Check the DATABASE_URL / POSTGRES_URL value at its source rather than ` +
        `relying on this warning to catch it every time.`,
    );
  }
}
