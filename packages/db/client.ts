// Client factory: one configured Drizzle instance over a `pg` Pool.
// See docs/ARCHITECTURE.md §5 (data access) — one pool for the web app, a
// separate one for the worker; each process calls createDb() once and
// shares the result.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requireDatabaseUrl } from "./env.ts";
import * as schema from "./schema/index.ts";

export function createDb() {
  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
