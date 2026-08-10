// Identity — linking a Supabase Auth user to this application's own
// `people`/`credentials`/`roles` tables. DOMAIN-MODEL §2, ARCHITECTURE §7
// (phase 4, build order). Deliberately narrow: this is the domain-data
// half of auth (who is this person, what can they do), not the session
// half (is this request authenticated) — that's Supabase Auth itself plus
// apps/web/app/lib/auth.ts, which composes a validated session with the
// lookups here. Keeping the split matches ARCHITECTURE §4.1: web and the
// future native client (apps/mobile) both need "who is this person" as a
// plain data query, but neither should reimplement it.
//
// Scope, this pass: password auth only. `provider` is always 'password'
// today; Google/Apple (ARCHITECTURE §7) reuse ensurePersonForAuthUser
// unchanged once wired, but multi-provider identity merging — the same
// human signing in with both password and Google — is not handled and
// not tested. Recorded as a real gap, not silently assumed away: see
// STATE.md.
import { and, eq } from "drizzle-orm";
import { credentials, people, roles } from "@summerice/db";
import type { Tx } from "@summerice/db";

export type CredentialProvider = "password" | "google" | "apple" | "email_link";
export type Role = "admin" | "scheduler" | "coach" | "player";

export interface EnsurePersonForAuthUserInput {
  authUserId: string;
  provider: CredentialProvider;
  email: string;
  fullName: string;
  defaultPosition: "skater" | "goalie" | "both";
}

export interface EnsurePersonForAuthUserResult {
  personId: string;
  isNewPerson: boolean;
}

/**
 * "A credentials row with provider_subject = auth.users.id, inserted on
 * first sign-in" (ARCHITECTURE §7 — provider there was written loosely as
 * 'supabase'; the actual value is whichever of the schema's four real
 * provider values was used, 'password' for this pass). Idempotent: safe
 * to call on every sign-in, not just the first one — an existing
 * (provider, authUserId) pair is a plain lookup, no write.
 *
 * Provisions `people` + `credentials` together in the same transaction —
 * the account and its login method never exist without each other, per
 * DOMAIN-MODEL §2's own framing of `credentials` as separable-but-never-
 * created-alone.
 */
export async function ensurePersonForAuthUser(
  tx: Tx,
  input: EnsurePersonForAuthUserInput,
): Promise<EnsurePersonForAuthUserResult> {
  const [existing] = await tx
    .select({ personId: credentials.personId })
    .from(credentials)
    .where(and(eq(credentials.provider, input.provider), eq(credentials.providerSubject, input.authUserId)));

  if (existing) {
    return { personId: existing.personId, isNewPerson: false };
  }

  const [person] = await tx
    .insert(people)
    .values({
      fullName: input.fullName,
      email: input.email,
      defaultPosition: input.defaultPosition,
      // Self-signup implies the "I am 16 or over" attestation was already
      // collected and required by the caller's form (DOMAIN-MODEL §2) —
      // this function trusts that happened and just timestamps it. Never
      // set for dependents, who never call this function themselves; a
      // guardian adds them directly, with no credentials row until
      // promoted.
      isAdultAttestedAt: new Date(),
      status: "active",
    })
    .returning({ id: people.id });
  if (!person) {
    throw new Error("ensurePersonForAuthUser: INSERT ... RETURNING on people produced no row");
  }

  await tx.insert(credentials).values({
    personId: person.id,
    provider: input.provider,
    providerSubject: input.authUserId,
  });

  return { personId: person.id, isNewPerson: true };
}

export interface PersonForAuthSubject {
  personId: string;
  fullName: string;
  email: string | null;
  status: "active" | "inactive";
}

/**
 * The read side of the link above — given a validated Supabase auth
 * subject (the JWT's `sub` claim), find the person it belongs to.
 * Provider-agnostic on purpose: by the time someone has a session, which
 * provider they used to get it doesn't matter for "who are they."
 * Returns null rather than throwing when no credentials row matches — a
 * valid Supabase session with no linked person is a real, expected state
 * (a JWT reused after the credentials row was somehow removed, or —
 * before ensurePersonForAuthUser has ever run for this subject — a caller
 * bug, not a database invariant violation), so the caller decides what to
 * do rather than this function assuming.
 */
export async function getPersonForAuthSubject(tx: Tx, authUserId: string): Promise<PersonForAuthSubject | null> {
  const [row] = await tx
    .select({
      personId: people.id,
      fullName: people.fullName,
      email: people.email,
      status: people.status,
    })
    .from(credentials)
    .innerJoin(people, eq(people.id, credentials.personId))
    .where(eq(credentials.providerSubject, authUserId));

  if (!row) return null;
  return { personId: row.personId, fullName: row.fullName, email: row.email, status: row.status as "active" | "inactive" };
}

/** All roles a person holds — `roles.person_id, roles.role`, DOMAIN-MODEL
 *  §2. A person with no rows here is an ordinary player; `player` is the
 *  implicit default, never stored as its own row (nothing checks for it). */
export async function getPersonRoles(tx: Tx, personId: string): Promise<Role[]> {
  const rows = await tx.select({ role: roles.role }).from(roles).where(eq(roles.personId, personId));
  return rows.map((r) => r.role as Role);
}

export async function personHasRole(tx: Tx, personId: string, role: Role): Promise<boolean> {
  const [row] = await tx
    .select({ role: roles.role })
    .from(roles)
    .where(and(eq(roles.personId, personId), eq(roles.role, role)));
  return row !== undefined;
}
