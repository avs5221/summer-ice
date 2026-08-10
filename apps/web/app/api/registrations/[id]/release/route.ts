// POST /api/registrations/:id/release — withdraw a registration. Thin
// caller: this is the natural place to chain release + promotion
// (releaseRegistration deliberately doesn't auto-promote itself — see its
// own docstring in packages/core/registration.ts, "composability"). A
// release on a waitlisted row (nothing actually taken) still calls
// promoteWaitlist; it's a cheap no-op there (`no_capacity`/`empty_queue`),
// simpler than branching on which kind of release this was.
//
// Same temporary auth gap as apps/web/app/api/registrations/route.ts:
// no session check on who's allowed to release this particular
// registration. Anyone who knows a registration id can withdraw it.
import { promoteWaitlist, releaseRegistration } from "@summerice/core";
import { registrationIdParamSchema } from "@summerice/contracts";
import { dbPooled } from "@summerice/db";
import { internalErrorResponse, isNotFoundError } from "~/lib/api-errors";

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
