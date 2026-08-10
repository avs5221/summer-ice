// POST /api/registrations — hold a cart. Thin caller only: parses and
// validates input, opens one transaction, calls packages/core's holdCart,
// serialises the result. No domain logic here — see
// .claude/rules/web-routes.md and docs/ARCHITECTURE.md §4.1.
//
// SECURITY GAP, TEMPORARY AND KNOWN: Supabase Auth doesn't exist yet
// (ARCHITECTURE §7, phase 4 — this route is phase 6-shaped plumbing built
// ahead of it, on direct instruction). personId comes straight from the
// request body, unverified against any session, because there is no
// session to verify it against. Anyone who can reach this route can hold
// a cart as any person id they choose. This is acceptable only because
// nothing here is deployed for real registration and no real money or
// real people's data is at stake yet — it must not go live, and this
// route must not be wired into real player-facing UI, until a
// session-derived identity replaces the body-supplied personId. Tracked
// in docs/STATE.md's open questions.
import { holdCart } from "@summerice/core";
import { holdCartRequestSchema } from "@summerice/contracts";
import { dbPooled } from "@summerice/db";
import { internalErrorResponse } from "~/lib/api-errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = holdCartRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const db = dbPooled();
  try {
    const result = await db.transaction((tx) => holdCart(tx, parsed.data));
    return Response.json(result, { status: 201 });
  } catch (err) {
    return internalErrorResponse("api/registrations POST", err);
  }
}
