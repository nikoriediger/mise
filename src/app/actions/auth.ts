"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/i18n";

export type AuthState = { error?: string; message?: string } | undefined;

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: t.auth.invalidCredentials };
  }
  redirect("/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const familyName = String(formData.get("family_name") ?? "").trim();
  const inviteToken = String(formData.get("invite") ?? "").trim();

  if (password.length < 8) {
    return { error: t.auth.passwordTooShort };
  }

  const supabase = await createClient();

  // The database enforces these rules too; checking first gives a clear message.
  if (inviteToken) {
    const { data } = await supabase.rpc("get_invite", { p_token: inviteToken });
    if (!data?.length) return { error: t.auth.invalidInvite };
  } else {
    const { data: mode } = await supabase.rpc("get_signup_mode");
    if (mode !== "open") return { error: t.auth.signupDisabled };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        family_name: familyName || t.auth.familyNameDefault,
        cookbook_name: t.cookbooks.defaultName(displayName),
        invite_token: inviteToken || undefined,
      },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: t.auth.passwordTooShort };
    if (error.code === "user_already_exists") return { error: error.message };
    return { error: inviteToken ? t.auth.invalidInvite : t.common.error };
  }

  if (!data.session) {
    // Email confirmation is enabled in Supabase.
    return { message: t.auth.checkEmail };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
