// Composes a validated Supabase session with the domain-side identity
// lookup (packages/core/identity.ts) into the two things a route handler,
// Server Action, or Server Component actually needs: "who is this" and
// "are they allowed to do this." Every one of those call sites calls this
// itself — per Next's own data-security guide and proxy.ts's docstring, a
// page-level or proxy-level check never extends to the Server Actions or
// route handlers nested under it.
import { dbPooled, type Tx } from "@summerice/db";
import { getPersonForAuthSubject, personHasRole, type PersonForAuthSubject, type Role } from "@summerice/core";
import { createSupabaseServerClient } from "./supabase/server";

export interface CurrentPerson extends PersonForAuthSubject {
  authUserId: string;
}

/**
 * getClaims(), never getSession() — Supabase's own docs are explicit that
 * getSession() reads local/cookie state without re-validating the token
 * and must never be trusted for an authorization decision. Returns null
 * for "no session" and for "session valid but no linked person" alike;
 * callers that need to tell those apart don't exist yet, and conflating
 * them keeps this function's contract simple until one does.
 */
export async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const authUserId = data?.claims.sub as string | undefined;
  if (!authUserId) return null;

  const db = dbPooled();
  const person = await db.transaction((tx: Tx) => getPersonForAuthSubject(tx, authUserId));
  if (!person) return null;

  return { ...person, authUserId };
}

export type AuthzResult =
  | { ok: true; person: CurrentPerson }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/** No session, or a session with no linked person. */
export async function requireCurrentPerson(): Promise<AuthzResult> {
  const person = await getCurrentPerson();
  if (!person) return { ok: false, reason: "unauthenticated" };
  return { ok: true, person };
}

/**
 * Ownership OR a role — the shape every one of this app's "can this
 * person act on this resource" checks takes (DOMAIN-MODEL §2's role
 * table: admins see and do everything; everyone else is scoped to
 * themselves). `ownerPersonId` is whatever the target resource's own
 * person_id column says — the caller fetches that itself (a plain read,
 * not domain logic — see .claude/rules/web-routes.md) before calling
 * this.
 */
export async function requireOwnerOrRole(ownerPersonId: string, role: Role): Promise<AuthzResult> {
  const current = await requireCurrentPerson();
  if (!current.ok) return current;
  if (current.person.personId === ownerPersonId) return current;

  const db = dbPooled();
  const hasRole = await db.transaction((tx: Tx) => personHasRole(tx, current.person.personId, role));
  if (hasRole) return current;

  return { ok: false, reason: "forbidden" };
}
