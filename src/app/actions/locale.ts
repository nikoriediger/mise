"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

/** Stores the UI language in a cookie and, when signed in, in the user's profile (follows them to new devices). */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user && data.user.user_metadata?.locale !== locale) {
    await supabase.auth.updateUser({ data: { locale } });
  }
}
