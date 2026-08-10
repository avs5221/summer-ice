// Browser-side Supabase Auth client — Client Components only (sign-in/
// sign-up forms, anything that needs auth.onAuthStateChange). Distinct
// from ../supabase-client.ts's Realtime client — see server.ts's comment
// for why the two stay separate.
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
