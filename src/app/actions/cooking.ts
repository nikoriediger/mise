"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getRecipe, isUuid } from "@/lib/data";
import { IMAGE_BUCKET } from "@/lib/types";
import { getActionI18n } from "@/i18n/server";

export async function setFavorite(recipeId: string, favorite: boolean): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!isUuid(recipeId)) return { ok: false };
  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ user_id: user.id, recipe_id: recipeId }, { onConflict: "user_id,recipe_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export type CookLogInput = { recipeId: string; cookedOn: string; rating: number | null; comment: string; photoPath: string | null };

/** "Cooked today": adds an entry to the recipe's cooking diary. */
export async function logCooking(input: CookLogInput): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const { t } = await getActionI18n();
  const recipe = await getRecipe(input.recipeId);
  if (!recipe) return { error: t.common.error };
  const cookedOn = /^\d{4}-\d{2}-\d{2}$/.test(input.cookedOn) ? input.cookedOn : new Date().toISOString().slice(0, 10);
  const rating = input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null;
  if (input.photoPath && !input.photoPath.startsWith(`${recipe.family_id}/${recipe.id}/log-`)) return { error: t.common.error };

  const supabase = await createClient();
  const { error } = await supabase.from("cook_log").insert({
    recipe_id: recipe.id,
    user_id: user.id,
    cooked_on: cookedOn,
    rating,
    comment: input.comment.trim().slice(0, 1000),
    photo_path: input.photoPath,
  });
  if (error) return { error: t.common.error };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteCookLog(entryId: string): Promise<void> {
  await getCurrentUser();
  if (!isUuid(entryId)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("cook_log").select("photo_path").eq("id", entryId).maybeSingle();
  if (data?.photo_path) await supabase.storage.from(IMAGE_BUCKET).remove([data.photo_path]);
  await supabase.from("cook_log").delete().eq("id", entryId);
  revalidatePath("/", "layout");
}
