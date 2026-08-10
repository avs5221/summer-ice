import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { roles } from "@summerice/db";
import {
  ensurePersonForAuthUser,
  getPersonForAuthSubject,
  getPersonRoles,
  personHasRole,
} from "../identity.ts";
import { withRollback } from "./harness.ts";

function fakeAuthUserId(): string {
  // A stand-in for a Supabase auth.users.id (the JWT's `sub` claim).
  // These tests never touch Supabase Auth itself — only this package's
  // own people/credentials tables, which don't care whether the UUID
  // came from a real auth user.
  return randomUUID();
}

void test("ensurePersonForAuthUser: first call provisions a new person + credentials row", async () => {
  await withRollback(async (tx) => {
    const authUserId = fakeAuthUserId();
    const result = await ensurePersonForAuthUser(tx, {
      authUserId,
      provider: "password",
      email: "alice@example.com",
      fullName: "Alice Skater",
      defaultPosition: "skater",
    });

    assert.equal(result.isNewPerson, true);
    assert.ok(result.personId);

    const found = await getPersonForAuthSubject(tx, authUserId);
    assert.deepEqual(found, {
      personId: result.personId,
      fullName: "Alice Skater",
      email: "alice@example.com",
      status: "active",
    });
  });
});

void test("ensurePersonForAuthUser: idempotent — a second call for the same subject returns the same person, no duplicate row", async () => {
  await withRollback(async (tx) => {
    const authUserId = fakeAuthUserId();
    const first = await ensurePersonForAuthUser(tx, {
      authUserId,
      provider: "password",
      email: "bob@example.com",
      fullName: "Bob Goalie",
      defaultPosition: "goalie",
    });
    const second = await ensurePersonForAuthUser(tx, {
      authUserId,
      provider: "password",
      email: "bob@example.com",
      fullName: "Bob Goalie",
      defaultPosition: "goalie",
    });

    assert.equal(second.isNewPerson, false);
    assert.equal(second.personId, first.personId);
  });
});

void test("getPersonForAuthSubject: null for a subject with no linked person", async () => {
  await withRollback(async (tx) => {
    const found = await getPersonForAuthSubject(tx, fakeAuthUserId());
    assert.equal(found, null);
  });
});

void test("getPersonRoles / personHasRole: reflect the roles table, empty by default", async () => {
  await withRollback(async (tx) => {
    const { personId } = await ensurePersonForAuthUser(tx, {
      authUserId: fakeAuthUserId(),
      provider: "password",
      email: "cas@example.com",
      fullName: "Cas Admin",
      defaultPosition: "skater",
    });

    assert.deepEqual(await getPersonRoles(tx, personId), []);
    assert.equal(await personHasRole(tx, personId, "admin"), false);

    await tx.insert(roles).values({ personId, role: "admin" });

    assert.deepEqual(await getPersonRoles(tx, personId), ["admin"]);
    assert.equal(await personHasRole(tx, personId, "admin"), true);
    assert.equal(await personHasRole(tx, personId, "coach"), false);
  });
});
