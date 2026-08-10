// drizzle-kit config: schema -> migrations. Run via the root db:generate /
// db:migrate / db:studio scripts so this is always invoked with the repo
// root .env loaded (drizzle-kit reads .env from the current working
// directory). See docs/ARCHITECTURE.md §5.
//
// Deliberately DIRECT_URL, not DATABASE_URL: `migrate` runs each migration
// as a multi-statement transaction, which the transaction-mode pooler
// (DATABASE_URL) does not support. Pointing this at the pooler is the
// second of the two connection-string gotchas — see §5 and client.ts.
import { defineConfig } from "drizzle-kit";
import { requireDirectUrl } from "./env.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: requireDirectUrl(),
  },
});
