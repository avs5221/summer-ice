// Server-side Supabase Auth client — Server Components, Server Actions,
// and app/api/* route handlers. This is a SEPARATE client from
// ../supabase-client.ts (the browser-only, unauthenticated Realtime
// client): that one exists because the live-fill channel is deliberately
// public and has nothing to do with a signed-in session (ARCHITECTURE §8);
// this one exists because Supabase Auth does. Keeping them apart means a
// hiccup in one never touches the other.
//
// Cookie pattern is getAll/setAll — verified current against Supabase's
// own docs at implementation time (2026-08-10), not from memory, per
// ARCHITECTURE §7's explicit warning that this SDK moves fast. The older
// three-method get/set/remove pattern shown in older tutorials/blog posts
// is superseded; do not "fix" this back to that shape.
//
// Per Next.js's own data-security guide (bundled in
// node_modules/next/dist/docs/01-app/02-guides/data-security.md): a
// page-level check does not extend to Server Actions or route handlers
// defined within it. Every Server Action and route handler in this app
// re-verifies identity itself via getCurrentPerson() (../auth.ts) rather
// than trusting proxy.ts or a parent page to have already gated access.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which can't set cookies —
            // harmless as long as proxy.ts is also refreshing the
            // session (it is, see apps/web/proxy.ts), same as the
            // upstream docs' own try/catch.
          }
        },
      },
    },
  );
}
