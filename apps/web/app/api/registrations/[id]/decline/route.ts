// POST /api/registrations/:id/decline — decline a waitlist offer.
// declineOffer already promotes the next person itself, in the same
// transaction (packages/core/waitlist.ts) — no orchestration needed here,
// unlike the release route.
//
// Same temporary auth gap as the other routes in this directory: no
// session check on who's allowed to decline this particular offer.
import { declineOffer } from "@summerice/core";
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
    const result = await db.transaction((tx) => declineOffer(tx, { registrationId: parsedId.data }));
    if (result.outcome === "not_offered") {
      // Not an error exactly — a legitimate outcome (already declined,
      // already expired, or never was offered) — but not a 200 either,
      // since there was nothing to decline. 409: the resource's current
      // state conflicts with the requested action.
      return Response.json(result, { status: 409 });
    }
    return Response.json(result);
  } catch (err) {
    if (isNotFoundError(err)) {
      return Response.json({ error: "registration not found" }, { status: 404 });
    }
    return internalErrorResponse("api/registrations/:id/decline POST", err);
  }
}
