// Resolves DATABASE_URL for both the client factory and drizzle.config.ts.
//
// In production DATABASE_URL is injected directly into the process
// environment (see docs/ARCHITECTURE.md §10 — a .env file on the host, read
// by Compose at container start). In local dev, though, drizzle-kit and
// this package's own scripts are invoked via `pnpm --filter @summerice/db
// run ...`, which sets cwd to packages/db — not the repo root where .env
// actually lives — so there's nothing there to auto-load it. This does a
// minimal, dependency-free load of the repo-root .env as a fallback, only
// when DATABASE_URL isn't already present in the environment. It still
// fails loudly (see requireDatabaseUrl below) if the variable is absent
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

export function requireDatabaseUrl(): string {
  loadRootEnvFileOnce();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env at the repo " +
        "root and fill it in (see docs/ARCHITECTURE.md §10 on secrets).",
    );
  }
  return url;
}
