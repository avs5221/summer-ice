"use server";

// Shared, unlike login/signup's own actions.ts files, since logout is
// callable from anywhere a signed-in person might be (nav, account page)
// rather than one dedicated form.
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
