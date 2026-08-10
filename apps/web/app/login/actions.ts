"use server";

import { redirect } from "next/navigation";
import { ensurePersonForAuthUser, getPersonForAuthSubject } from "@summerice/core";
import { loginRequestSchema } from "@summerice/contracts";
import { dbPooled } from "@summerice/db";
import { createSupabaseServerClient } from "~/lib/supabase/server";

export interface LoginActionState {
  error?: string;
}

export async function login(_prevState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginRequestSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  // Defensive safety net, not the primary provisioning path (that's
  // signup/actions.ts, which runs at signUp() time regardless of email
  // confirmation). Idempotent — a no-op lookup for the normal case where
  // the person already exists. Falls back to a placeholder full name
  // rather than failing login outright if it somehow doesn't; a missing
  // name is a data-quality issue an admin can fix, not a reason to lock
  // someone out of an account they just proved they own.
  const db = dbPooled();
  await db.transaction(async (tx) => {
    const existing = await getPersonForAuthSubject(tx, data.user.id);
    if (existing) return;
    await ensurePersonForAuthUser(tx, {
      authUserId: data.user.id,
      provider: "password",
      email: data.user.email ?? parsed.data.email,
      fullName: data.user.email ?? "Unnamed player",
      defaultPosition: "skater",
    });
  });

  redirect("/");
}
