// POST /api/registrations — hold a cart. Thin caller only: parses and
// validates input, opens one transaction, calls packages/core's holdCart,
// serialises the result. No domain logic here — see
// .claude/rules/web-routes.md and docs/ARCHITECTURE.md §4.1.
//
// personId comes from the caller's own authenticated session
// (getCurrentPerson), never from the request body — closing the gap
// flagged when this route was first built (see docs/DECISIONS.md,
// 2026-08-10, for the history: this route predates auth by design,
// built ahead of phase 4 on direct instruction, with the gap tracked
// rather than silently accepted).
import { holdCart } from "@summerice/core";
import { holdCartRequestSchema } from "@summerice/contracts";
import { dbPooled } from "@summerice/db";
import { internalErrorResponse } from "~/lib/api-errors";
import { requireCurrentPerson } from "~/lib/auth";

export async function POST(request: Request) {
  const auth = await requireCurrentPerson();
  if (!auth.ok) {
    return Response.json({ error: "authentication required" }, { status: 401 });
  }

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
    const result = await db.transaction((tx) =>
      holdCart(tx, { personId: auth.person.personId, seasonId: parsed.data.seasonId, lines: parsed.data.lines }),
    );
    return Response.json(result, { status: 201 });
  } catch (err) {
    return internalErrorResponse("api/registrations POST", err);
  }
}
