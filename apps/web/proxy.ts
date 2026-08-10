// Refreshes the Supabase Auth session cookie on every request. This is
// Next.js 16's renamed `middleware.ts` convention — `middleware` is
// deprecated as of v16.0.0, and this repo is on 16.3.0
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md,
// checked directly against the installed package rather than assumed, per
// AGENTS.md's warning that this Next.js version has convention changes
// outside training-data memory). If a future upgrade brings the file back
// under the `middleware.ts` name, that's a real regression to fix, not a
// stylistic reversion.
//
// Deliberately does NOT redirect unauthenticated requests anywhere. Two
// reasons: (1) nothing in apps/web is role-gated yet — every existing page
// is still fake-data, wave-1 UI — so there's no protected route to redirect
// away from; (2) per Next's own data-security guide (bundled at
// node_modules/next/dist/docs/01-app/02-guides/data-security.md) and
// proxy.md's own warning ("A matcher change or a refactor... can silently
// remove Proxy coverage. Always verify authentication and authorization
// inside each Server Function"), proxy redirects are UX, never the actual
// security boundary. Every route handler that needs identity calls
// getCurrentPerson() (app/lib/auth.ts) itself. Add page-level redirects
// here later if/when a whole route tree needs gating, but keep the
// per-handler checks regardless.
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims() — a stray
  // early return here is exactly how a session silently stops refreshing.
  // getClaims() (not getSession()) is what forces the refresh check: per
  // Supabase's own docs, getSession() reads local/cookie state without
  // re-validating and must never be trusted for this.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimization — running Auth's cookie
    // logic against those is pure overhead with nothing to refresh.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
