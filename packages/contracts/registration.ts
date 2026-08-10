// Request schemas for the season-registration routes
// (apps/web/app/api/registrations/**). Response shapes are NOT
// schema-validated here — they're the already-typed results
// packages/core's holdCart/releaseRegistration/declineOffer return, and
// re-validating trusted output we just produced would be redundant. Zod's
// job in this file is untrusted input only, per docs/ARCHITECTURE.md §3
// ("Zod schemas, derived types, an API client") — this is the schema half;
// the generated client is a later phase (apps/mobile, phase 4/12).
import { z } from "zod";

export const positionSchema = z.enum(["skater", "goalie"]);
export type PositionInput = z.infer<typeof positionSchema>;

export const holdCartLineSchema = z.object({
  slotId: z.uuid(),
  position: positionSchema,
});

export const holdCartRequestSchema = z.object({
  personId: z.uuid(),
  seasonId: z.uuid(),
  lines: z.array(holdCartLineSchema).min(1, "at least one line is required"),
});
export type HoldCartRequest = z.infer<typeof holdCartRequestSchema>;

export const registrationIdParamSchema = z.uuid();
