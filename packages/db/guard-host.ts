// Hard safety gate, run BEFORE the real command in every db:* package.json
// script that resolves a database connection. See CLAUDE.md → "Environment
// files" for why this exists: a single shared .env used to make it
// possible for a local-only command (db:nuke, most infamously) to silently
// reach the real Supabase project, because every script just read whatever
// happened to be in one file. This makes that structurally impossible
// rather than trusting anyone — including a future agent session — to
// remember which file is loaded and check by hand.
//
// This is a hard exit, not a warning. A warning is something a script
// running unattended, or an agent moving fast, will not see in time.
//
// Usage: node guard-host.ts <local-only|remote-required> [pooled|direct]
import { requireDirectUrl, requirePooledUrl } from "./env.ts";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

const mode = process.argv[2];
const which = process.argv[3] === "pooled" ? "pooled" : "direct";

if (mode !== "local-only" && mode !== "remote-required") {
  console.error(`[guard-host] unknown mode "${String(mode)}" — expected "local-only" or "remote-required".`);
  process.exit(1);
}

const url = which === "pooled" ? requirePooledUrl() : requireDirectUrl();
const host = new URL(url).hostname;
const isLocal = LOCAL_HOSTS.has(host);

if (mode === "local-only" && !isLocal) {
  console.error(
    `\n[guard-host] REFUSING TO RUN.\n` +
      `This command only ever runs against local Postgres, but the resolved host is\n` +
      `"${host}" — not localhost or 127.0.0.1.\n\n` +
      `This almost always means .env.local is missing or misconfigured, or\n` +
      `SUMMERICE_ENV=production leaked into this shell from a previous command.\n` +
      `See CLAUDE.md → "Environment files" before proceeding. Do not bypass this —\n` +
      `it exists because exactly this mistake once pointed a migration at\n` +
      `production instead of a local dry run.\n`,
  );
  process.exit(1);
}

if (mode === "remote-required" && isLocal) {
  console.error(
    `\n[guard-host] REFUSING TO RUN.\n` +
      `This is a "prod" command and must target a real remote database, but the\n` +
      `resolved host is "${host}" (local). If you meant to run against local\n` +
      `Postgres, use the non-":prod" script instead.\n`,
  );
  process.exit(1);
}

console.log(`[guard-host] OK — ${which} host "${host}" (${isLocal ? "local" : "remote"}) matches expected mode "${mode}".`);
