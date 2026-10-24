"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyCookbooks, getPrimaryFamily, isUuid } from "@/lib/data";
import { COOKBOOK_EMOJIS } from "@/lib/types";
import { t } from "@/i18n";

export type CookbookFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const emoji = String(formData.get("emoji") ?? "");
  return { name, emoji: COOKBOOK_EMOJIS.includes(emoji) ? emoji : COOKBOOK_EMOJIS[0] };
}

/** Creates a new collection. */
export async function createCookbook(_prev: CookbookFormState, formData: FormData): Promise<CookbookFormState> {
  const user = await getCurrentUser();
  const family = await getPrimaryFamily();
  const { name, emoji } = readForm(formData);
  if (!name) return { error: t.cookbooks.nameRequired };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cookbooks")
    .insert({ family_id: family.family_id, owner_id: user.id, name, emoji })
    .select("id")
    .single();
  if (error) return { error: t.common.error };

  revalidatePath("/", "layout");
  redirect(`/cookbooks/${data.id}`);
}

export async function updateCookbook(_prev: CookbookFormState, formData: FormData): Promise<CookbookFormState> {
  await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const { name, emoji } = readForm(formData);
  if (!name) return { error: t.cookbooks.nameRequired };
  if (!isUuid(id)) return { error: t.common.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("cookbooks").update({ name, emoji }).eq("id", id).select("id");
  if (error || !data.length) return { error: t.common.error };

  revalidatePath("/", "layout");
  return {};
}

/** Deletes an own collection. Its recipes stay; the main cookbook can't be deleted. */
export async function deleteCookbook(id: string): Promise<{ error: string } | undefined> {
  const cookbook = (await getMyCookbooks()).find((b) => b.id === id);
  if (!cookbook) return { error: t.common.error };
  if (cookbook.is_default) return { error: t.cookbooks.cannotDeleteMain };

  const supabase = await createClient();
  const { data, error } = await supabase.from("cookbooks").delete().eq("id", id).select("id");
  if (error || !data.length) return { error: t.common.error };

  revalidatePath("/", "layout");
  redirect("/cookbooks");
}
