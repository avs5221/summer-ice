"use server";

// Per Next's own data-security guide: a Server Action is a separate entry
// point from the page that renders its form, and must validate its own
// input regardless of what the client-side form already checked.
import { redirect } from "next/navigation";
import { ensurePersonForAuthUser } from "@summerice/core";
import { signupRequestSchema } from "@summerice/contracts";
import { dbPooled } from "@summerice/db";
import { createSupabaseServerClient } from "~/lib/supabase/server";

export interface SignupActionState {
  error?: string;
}

export async function signup(_prevState: SignupActionState, formData: FormData): Promise<SignupActionState> {
  // DOMAIN-MODEL §2: the "I am 16 or over" attestation is required at
  // self-signup and is what is_adult_attested_at records. A checkbox's
  // presence in FormData ("on") is a UI-required-field concern, not a zod
  // shape, so it's checked here directly rather than folded into
  // signupRequestSchema.
  if (formData.get("ageAttested") !== "on") {
    return { error: "You must confirm you are 16 or older to create an account." };
  }

  const parsed = signupRequestSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    defaultPosition: formData.get("defaultPosition"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "Sign-up did not return a user — try again." };
  }

  // Provisions people + credentials together — see
  // packages/core/identity.ts's docstring. data.user.id is populated
  // immediately regardless of whether email confirmation is pending, so
  // this doesn't need to wait for an active session.
  const db = dbPooled();
  await db.transaction((tx) =>
    ensurePersonForAuthUser(tx, {
      authUserId: data.user!.id,
      provider: "password",
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      defaultPosition: parsed.data.defaultPosition,
    }),
  );

  // Whether signUp returns an active session depends on the Supabase
  // project's email-confirmation setting, which this code doesn't (and
  // shouldn't) assume either way.
  if (data.session) {
    redirect("/");
  }
  redirect("/signup/check-email");
}
