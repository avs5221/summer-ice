// Two connection factories — see docs/ARCHITECTURE.md §5 ("Two connection
// strings") for the full reasoning, restated briefly here since this is
// exactly the file where getting it wrong is invisible until Vercel.
//
// dbPooled() — runtime queries (loaders, actions, route handlers, and any
// future Vercel Cron endpoint draining the outbox). Connects through
// Supabase's transaction-mode pooler. Two non-negotiable settings:
//
//   - `prepare: false` — the pooler does not support prepared statements,
//     and postgres-js uses them by default. Omit this and every query
//     works against a local or direct connection, then fails once deployed
//     behind the pooler. This is the single most common way to ship this
//     wrong.
//   - `max: 1` — one connection per serverless function invocation.
//     Vercel can spin up hundreds of concurrent function instances; each
//     one importing this module and calling dbPooled() with an unbounded
//     pool is how you exhaust the pooler's own connection budget before a
//     single user notices anything is wrong. Keep transactions short.
//
// dbDirect() — migrations and one-off scripts (seed.ts, drizzle-kit).
// Connects straight to Postgres, bypassing the pooler entirely, because
// transaction-mode pooling does not support the multi-statement
// transactions a migration runs as. Never call this from request-serving
// code — it has no connection cap suited to serverless concurrency, and
// it's wired to DIRECT_URL, which is not meant to receive production
// traffic volume.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireDirectUrl, requirePooledUrl } from "./env.ts";
import * as schema from "./schema/index.ts";

export function dbPooled() {
  const sql = postgres(requirePooledUrl(), { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}

export function dbDirect() {
  const sql = postgres(requireDirectUrl());
  return drizzle(sql, { schema });
}

// Same as dbDirect(), with a configurable connection cap — for scripts
// that need genuine concurrency against local Postgres rather than the
// postgres-js default of 10 (packages/core's load-test harness, which
// fires several hundred concurrent holdCart calls and needs enough real
// connections open at once to actually exercise row-lock contention, not
// queue behind a small pool). Still never for request-serving code — the
// "one-off script" rule from dbDirect() above applies here too, just with
// a caller-chosen ceiling instead of the default.
export function dbDirectPooled(max: number) {
  const sql = postgres(requireDirectUrl(), { max });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof dbPooled>;

// The transaction handle every packages/core function takes as its first
// argument — see docs/ARCHITECTURE.md §4.1 and .claude/rules/core.md.
// Derived structurally from Db's own `.transaction()` callback rather than
// naming drizzle's internal generic type, so it stays correct across
// drizzle-orm versions without hand-tracking its exports.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
