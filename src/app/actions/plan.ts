"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUuid } from "@/lib/data";
import { scaleIngredient } from "@/lib/scale-ingredients";
import { addShoppingLines, type ListKind } from "./shopping";

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function planRecipe(recipeId: string, day: string, servings: number | null): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!isUuid(recipeId) || !isDate(day)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan").insert({
    user_id: user.id,
    recipe_id: recipeId,
    planned_on: day,
    servings: servings && servings > 0 ? Math.min(100, Math.round(servings)) : null,
  });
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function removePlanned(id: string) {
  await getCurrentUser();
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("meal_plan").delete().eq("id", id);
  revalidatePath("/", "layout");
}

/** Puts the (scaled) ingredients of all recipes planned between two days on a shopping list. */
export async function planToShopping(from: string, to: string, list: ListKind): Promise<{ added: number }> {
  const user = await getCurrentUser();
  if (!isDate(from) || !isDate(to)) return { added: 0 };
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plan")
    .select("servings, recipes(title, servings, ingredients)")
    .eq("user_id", user.id)
    .gte("planned_on", from)
    .lte("planned_on", to);

  let added = 0;
  for (const entry of data ?? []) {
    const recipe = entry.recipes as unknown as { title: string; servings: number | null; ingredients: string[] } | null;
    if (!recipe) continue;
    const factor = entry.servings && recipe.servings ? entry.servings / recipe.servings : 1;
    const lines = recipe.ingredients.map((line) => scaleIngredient(line, factor));
    added += (await addShoppingLines(lines, list, recipe.title)).added;
  }
  return { added };
}
