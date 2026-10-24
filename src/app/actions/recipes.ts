"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyCookbooks, getRecipe, isUuid } from "@/lib/data";
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
  /** Family folder the images were uploaded to: <familyId>/<recipeId>/... */
  familyId: string;
  /** The (own) cookbook the recipe is saved in. */
  cookbookId: string;
  isNew: boolean;
  draft: RecipeDraft;
  images: ImageState[];
};

export type SaveRecipeResult = { error: string } | undefined;

/**
 * Creates or updates a recipe and syncs its images. Image files are uploaded
 * by the browser beforehand to <familyId>/<recipeId>/..., this action only
 * records them (and deletes images that were removed).
 */
export async function saveRecipe(input: SaveRecipeInput): Promise<SaveRecipeResult> {
  const user = await getCurrentUser();
  const { id, familyId, cookbookId, isNew, images } = input;

  const cookbook = (await getMyCookbooks()).find((b) => b.id === cookbookId);
  if (!isUuid(id) || !cookbook || cookbook.family_id !== familyId) {
    return { error: t.common.error };
  }
  const draft = cleanDraft(input.draft);
  if (!draft.title) {
    return { error: t.form.titleRequired };
  }
  const prefix = `${familyId}/${id}/`;
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
    // RLS only lets owners update; moving is limited to own cookbooks of the same family.
    const { data, error } = await supabase
      .from("recipes")
      .update({ ...draft, cookbook_id: cookbookId })
      .eq("id", id)
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
        family_id: familyId,
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

/** Copies a recipe (including its images) into one of the user's own cookbooks. */
export async function copyRecipe(sourceId: string, targetCookbookId: string): Promise<{ error: string } | undefined> {
  const user = await getCurrentUser();
  const source = await getRecipe(sourceId);
  const target = (await getMyCookbooks()).find((b) => b.id === targetCookbookId);
  if (!source || !target) return { error: t.common.error };

  const supabase = await createClient();
  const newId = crypto.randomUUID();
  const { error } = await supabase.from("recipes").insert({
    id: newId,
    cookbook_id: target.id,
    created_by: user.id,
    title: source.title,
    servings: source.servings,
    prep_minutes: source.prep_minutes,
    cook_minutes: source.cook_minutes,
    ingredients: source.ingredients,
    steps: source.steps,
    notes: source.notes,
    category: source.category,
    tags: source.tags,
  });
  if (error) return { error: t.common.error };

  const copies = [];
  for (const img of source.images) {
    const fileName = img.storage_path.split("/").pop();
    const path = `${target.family_id}/${newId}/${fileName}`;
    const { error: copyError } = await supabase.storage.from(IMAGE_BUCKET).copy(img.storage_path, path);
    if (!copyError) {
      copies.push({
        recipe_id: newId,
        family_id: target.family_id,
        storage_path: path,
        role: img.role,
        sort_order: img.sort_order,
        is_cover: img.is_cover,
      });
    }
  }
  if (copies.length) await supabase.from("recipe_images").insert(copies);

  revalidatePath("/", "layout");
  redirect(`/recipes/${newId}`);
}

export async function deleteRecipe(id: string) {
  await getCurrentUser();
  const recipe = await getRecipe(id);
  if (!recipe?.canEdit) return;
  const supabase = await createClient();

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
  if (recipe.images.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove(recipe.images.map((img) => img.storage_path));
  }

  revalidatePath("/", "layout");
  redirect(`/cookbooks/${recipe.cookbook_id}`);
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
