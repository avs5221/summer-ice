// Browser-side Supabase client — Realtime subscriptions only. This is
// deliberately the ONLY thing supabase-js is used for in this app: per
// docs/ARCHITECTURE.md, ordinary data access goes through Drizzle over a
// direct Postgres connection (packages/db), never through supabase-js or
// PostgREST. Realtime is the one piece supabase-js is actually needed for,
// since subscribing to a broadcast channel is a client-side websocket
// concern with no Drizzle equivalent.
//
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
// These are intentionally public — the publishable key is designed to be,
// and the data it unlocks here (aggregate fill counts on a PUBLIC broadcast
// channel, see packages/db/migrations/0005_live_fill_broadcast.sql) is not
// secret.
//
// Note on env loading: Next.js only auto-loads .env files from apps/web's
// own directory, not the repo-root .env.local / .env.production every
// other package in this monorepo reads (see packages/db/env.ts, which
// hand-loads one of those as a fallback for exactly this reason). Next
// does not offer an equivalent hook for its own NEXT_PUBLIC_* inlining, so
// — unlike every other env var in this repo — these two must also exist in
// apps/web/.env.local (a different file from the repo-root one of the same
// name — see CLAUDE.md → "Environment files"). See .env.production.example
// and apps/web/README.md.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set in " +
        "apps/web/.env.local (Next.js does not read the repo-root env files — see " +
        ".env.production.example).",
    );
  }

  client = createClient(url, publishableKey);
  return client;
}
