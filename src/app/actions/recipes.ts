"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMemberships, isUuid } from "@/lib/data";
import { IMAGE_BUCKET, type ImageRole, type RecipeDraft } from "@/lib/types";
import { t } from "@/i18n";

/** Final state of one image after editing. `id` is set for images that already existed. */
export type ImageState = {
  id?: string;
  storage_path: string;
  role: ImageRole;
  sort_order: number;
  is_cover: boolean;
};

export type SaveRecipeInput = {
  id: string;
  cookbookId: string;
  isNew: boolean;
  draft: RecipeDraft;
  images: ImageState[];
};

export type SaveRecipeResult = { error: string } | undefined;

/**
 * Creates or updates a recipe and syncs its images. Image files are uploaded
 * by the browser beforehand to <cookbookId>/<recipeId>/..., this action only
 * records them (and deletes images that were removed).
 */
export async function saveRecipe(input: SaveRecipeInput): Promise<SaveRecipeResult> {
  const user = await getCurrentUser();
  const memberships = await getMemberships();
  const { id, cookbookId, isNew, images } = input;

  if (!isUuid(id) || !memberships.some((m) => m.cookbook_id === cookbookId)) {
    return { error: t.common.error };
  }
  const draft = cleanDraft(input.draft);
  if (!draft.title) {
    return { error: t.form.titleRequired };
  }
  const prefix = `${cookbookId}/${id}/`;
  if (images.some((img) => !img.storage_path.startsWith(prefix))) {
    return { error: t.common.error };
  }

  const supabase = await createClient();

  if (isNew) {
    const { error } = await supabase
      .from("recipes")
      .insert({ id, cookbook_id: cookbookId, created_by: user.id, ...draft });
    if (error) return { error: t.common.error };
  } else {
    const { data, error } = await supabase
      .from("recipes")
      .update(draft)
      .eq("id", id)
      .eq("cookbook_id", cookbookId)
      .select("id");
    if (error || !data.length) return { error: t.common.error };
  }

  // Sync images
  const { data: existing, error: existingError } = await supabase
    .from("recipe_images")
    .select("id, storage_path")
    .eq("recipe_id", id);
  if (existingError) return { error: t.common.error };

  const keptIds = new Set(images.filter((img) => img.id).map((img) => img.id));
  const removed = existing.filter((img) => !keptIds.has(img.id));
  if (removed.length) {
    await supabase.from("recipe_images").delete().in("id", removed.map((img) => img.id));
    await supabase.storage.from(IMAGE_BUCKET).remove(removed.map((img) => img.storage_path));
  }

  const existingIds = new Set(existing.map((img) => img.id));
  for (const img of images.filter((img) => img.id && existingIds.has(img.id))) {
    await supabase
      .from("recipe_images")
      .update({ role: img.role, sort_order: img.sort_order, is_cover: img.is_cover })
      .eq("id", img.id!);
  }

  const added = images.filter((img) => !img.id);
  if (added.length) {
    const { error } = await supabase.from("recipe_images").insert(
      added.map((img) => ({
        recipe_id: id,
        cookbook_id: cookbookId,
        storage_path: img.storage_path,
        role: img.role,
        sort_order: img.sort_order,
        is_cover: img.is_cover,
      })),
    );
    if (error) return { error: t.form.uploadFailed };
  }

  revalidatePath("/", "layout");
  redirect(`/recipes/${id}`);
}

export async function deleteRecipe(id: string) {
  await getCurrentUser();
  if (!isUuid(id)) return;
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("recipe_images")
    .select("storage_path")
    .eq("recipe_id", id);
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
  if (images?.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove(images.map((img) => img.storage_path));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

function cleanDraft(draft: RecipeDraft): RecipeDraft {
  const lines = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
  const number = (n: number | null) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  return {
    title: draft.title.trim().slice(0, 200),
    servings: number(draft.servings) || null,
    prep_minutes: number(draft.prep_minutes),
    cook_minutes: number(draft.cook_minutes),
    ingredients: lines(draft.ingredients),
    steps: lines(draft.steps),
    notes: draft.notes.trim(),
    category: draft.category.trim(),
    tags: [...new Set(lines(draft.tags))],
  };
}
