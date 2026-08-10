// Request schemas for sign-up/sign-in. The age attestation checkbox
// (DOMAIN-MODEL §2 — "I am 16 or over," recorded at self-signup) is
// deliberately NOT modeled here as a boolean field: a checkbox's presence
// in FormData is inherently a UI-required-field concern, not a shape
// zod needs to parse — the signup Server Action checks it directly.
import { z } from "zod";

// people.default_position is a 3-value enum ('skater' | 'goalie' | 'both')
// — distinct from registration.ts's positionSchema (2-value, no 'both':
// a cart line is one specific position, not a preference). Named
// defaultPositionSchema, not positionSchema, so the two can be exported
// from the same package index without colliding.
export const defaultPositionSchema = z.enum(["skater", "goalie", "both"]);

export const signupRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "at least 8 characters"),
  fullName: z.string().trim().min(1, "required"),
  defaultPosition: defaultPositionSchema,
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "required"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
