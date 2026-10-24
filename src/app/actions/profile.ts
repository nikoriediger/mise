"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyCookbooks, getMyProfile } from "@/lib/data";
import { AVATAR_BUCKET } from "@/lib/types";
import { locales } from "@/i18n/config";
import { getMessages } from "@/i18n/dictionaries";
import { cookbookDefaultName } from "@/i18n/format";
import { getActionI18n } from "@/i18n/server";

export type ProfileResult = { error?: string; ok?: boolean };

/**
 * Saves name, bio and photo. `avatarPath`: new uploaded file, `null` to remove
 * the photo, `undefined` to keep it. Renames the main cookbook along with the
 * name, unless it was renamed by hand.
 */
export async function updateProfile(input: { displayName: string; bio: string; avatarPath?: string | null }): Promise<ProfileResult> {
  const user = await getCurrentUser();
  const { t, locale } = await getActionI18n();
  const displayName = input.displayName.trim().slice(0, 60);
  const bio = input.bio.trim().slice(0, 200);
  if (!displayName) return { error: t.profile.nameRequired };
  if (input.avatarPath && !input.avatarPath.startsWith(`${user.id}/`)) return { error: t.common.error };

  const before = await getMyProfile();
  const supabase = await createClient();
  const changes: Record<string, string | null> = { display_name: displayName, bio };
  if (input.avatarPath !== undefined) changes.avatar_path = input.avatarPath;

  // Update (only these columns are writable); create the profile if it doesn't exist yet
  const { data: updated, error } = await supabase.from("profiles").update(changes).eq("user_id", user.id).select("user_id");
  if (error) return { error: t.common.error };
  if (!updated.length) {
    const { error: insertError } = await supabase.from("profiles").insert({ user_id: user.id, ...changes });
    if (insertError) return { error: t.common.error };
  }

  if (input.avatarPath !== undefined && before.avatar_path && before.avatar_path !== input.avatarPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([before.avatar_path]);
  }

  // Rename main cookbooks that still carry the automatic name
  if (before.display_name && before.display_name !== displayName) {
    const oldNames = new Set([before.display_name, ...locales.map((l) => cookbookDefaultName(getMessages(l), before.display_name))]);
    for (const book of (await getMyCookbooks()).filter((b) => b.is_default && oldNames.has(b.name))) {
      await supabase.from("cookbooks").update({ name: cookbookDefaultName(getMessages(locale), displayName) }).eq("id", book.id);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(password: string): Promise<ProfileResult> {
  await getCurrentUser();
  const { t } = await getActionI18n();
  if (password.length < 8) return { error: t.auth.passwordTooShort };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? error.message : t.common.error };
  return { ok: true };
}

export async function setNotificationPrefs(prefs: { notify_notes?: boolean; notify_new_recipes?: boolean }): Promise<ProfileResult> {
  const user = await getCurrentUser();
  const { t } = await getActionI18n();
  const supabase = await createClient();
  const changes: Record<string, boolean> = {};
  if (typeof prefs.notify_notes === "boolean") changes.notify_notes = prefs.notify_notes;
  if (typeof prefs.notify_new_recipes === "boolean") changes.notify_new_recipes = prefs.notify_new_recipes;
  const { error } = await supabase.from("profiles").update(changes).eq("user_id", user.id);
  if (error) return { error: t.common.error };
  revalidatePath("/profile");
  return { ok: true };
}
