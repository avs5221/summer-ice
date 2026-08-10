// POST /api/registrations/:id/release — withdraw a registration. Thin
// caller: this is the natural place to chain release + promotion
// (releaseRegistration deliberately doesn't auto-promote itself — see its
// own docstring in packages/core/registration.ts, "composability"). A
// release on a waitlisted row (nothing actually taken) still calls
// promoteWaitlist; it's a cheap no-op there (`no_capacity`/`empty_queue`),
// simpler than branching on which kind of release this was.
//
// Ownership check, closing the gap flagged when this route was first
// built (docs/DECISIONS.md, 2026-08-10): only the registration's own
// person, or an admin, may release it — DOMAIN-MODEL §2's role table
// ("admin: everything") and §4's "revocation is human-only" (an admin
// removing someone is an ordinary withdrawn transition, same as
// self-service). The ownership lookup itself is a plain SELECT, not
// domain logic — .claude/rules/web-routes.md's line is about capacity/
// money/state-transition logic, not "which row does this id belong to."
import { eq } from "drizzle-orm";
import { promoteWaitlist, releaseRegistration } from "@summerice/core";
import { registrationIdParamSchema } from "@summerice/contracts";
import { dbPooled, registrations } from "@summerice/db";
import { internalErrorResponse, isNotFoundError } from "~/lib/api-errors";
import { requireOwnerOrRole } from "~/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsedId = registrationIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json({ error: "invalid registration id" }, { status: 400 });
  }

  const db = dbPooled();

  const [existing] = await db
    .select({ personId: registrations.personId })
    .from(registrations)
    .where(eq(registrations.id, parsedId.data));
  if (!existing) {
    return Response.json({ error: "registration not found" }, { status: 404 });
  }

  const auth = await requireOwnerOrRole(existing.personId, "admin");
  if (!auth.ok) {
    return Response.json(
      { error: auth.reason === "unauthenticated" ? "authentication required" : "forbidden" },
      { status: auth.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const released = await releaseRegistration(tx, { registrationId: parsedId.data });
      if (released.outcome !== "withdrawn") {
        return { released };
      }
      const promoted = await promoteWaitlist(tx, { slotId: released.slotId, position: released.position });
      return { released, promoted };
    });
    return Response.json(result);
  } catch (err) {
    if (isNotFoundError(err)) {
      return Response.json({ error: "registration not found" }, { status: 404 });
    }
    return internalErrorResponse("api/registrations/:id/release POST", err);
  }
}
