// drizzle-kit config: schema -> migrations. Run via the root db:generate /
// db:migrate / db:studio scripts so this is always invoked with the repo
// root .env loaded (drizzle-kit reads .env from the current working
// directory). See docs/ARCHITECTURE.md §5.
import { defineConfig } from "drizzle-kit";
import { requireDatabaseUrl } from "./env.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
});
