"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getFamilyMemberships, getMyCookbooks, getRecipe, isUuid } from "@/lib/data";
import { IMAGE_BUCKET, type ImageRole, type RecipeDraft } from "@/lib/types";
import { isLocale } from "@/i18n/config";
import { getActionI18n } from "@/i18n/server";

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
  /** Family the recipe belongs to; images were uploaded to <familyId>/<recipeId>/... */
  familyId: string;
  isNew: boolean;
  draft: RecipeDraft;
  images: ImageState[];
  /** The user's collections (not the main cookbook) the recipe should be in. */
  collectionIds: string[];
};

export type ActionResult = { error: string } | undefined;

/**
 * Creates or updates a recipe, syncs its images and its collections. Image
 * files are uploaded by the browser beforehand; this action only records them
 * (and deletes images that were removed).
 */
export async function saveRecipe(input: SaveRecipeInput): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const user = await getCurrentUser();
  const { id, familyId, isNew, images } = input;

  const families = await getFamilyMemberships();
  if (!isUuid(id) || !families.some((f) => f.family_id === familyId)) {
    return { error: t.common.error };
  }
  if (!isNew) {
    const existing = await getRecipe(id);
    if (!existing?.canEdit || existing.family_id !== familyId) return { error: t.common.error };
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
      .insert({ id, owner_id: user.id, family_id: familyId, created_by: user.id, ...draft });
    if (error) return { error: t.common.error };
  } else {
    const { data, error } = await supabase.from("recipes").update(draft).eq("id", id).select("id");
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

  await syncCollections(id, familyId, input.collectionIds);

  revalidatePath("/", "layout");
  redirect(`/recipes/${id}`);
}

/** Puts a recipe into exactly the given collections of the current user. */
export async function setRecipeCollections(recipeId: string, collectionIds: string[]): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const recipe = await getRecipe(recipeId);
  if (!recipe) return { error: t.common.error };
  const result = await syncCollections(recipe.id, recipe.family_id, collectionIds);
  revalidatePath("/", "layout");
  return result;
}

async function syncCollections(recipeId: string, familyId: string, wanted: string[]): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const user = await getCurrentUser();
  const collections = (await getMyCookbooks()).filter((b) => !b.is_default && b.family_id === familyId);
  const allowed = new Set(collections.map((b) => b.id));
  const target = new Set(wanted.filter((id) => allowed.has(id)));

  const supabase = await createClient();
  const { data: current, error } = await supabase
    .from("cookbook_recipes")
    .select("cookbook_id")
    .eq("recipe_id", recipeId)
    .in("cookbook_id", [...allowed]);
  if (error) return { error: t.common.error };

  const have = new Set(current.map((l) => l.cookbook_id));
  const toAdd = [...target].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !target.has(id));
  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("cookbook_recipes")
      .insert(toAdd.map((cookbook_id) => ({ cookbook_id, recipe_id: recipeId, added_by: user.id })));
    if (addError) return { error: t.common.error };
  }
  if (toRemove.length) {
    await supabase.from("cookbook_recipes").delete().eq("recipe_id", recipeId).in("cookbook_id", toRemove);
  }
  return undefined;
}

/** Adds existing recipes of the family to one of the user's collections. */
export async function addRecipesToCookbook(cookbookId: string, recipeIds: string[]): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const user = await getCurrentUser();
  const cookbook = (await getMyCookbooks()).find((b) => b.id === cookbookId && !b.is_default);
  const ids = recipeIds.filter(isUuid);
  if (!cookbook || ids.length === 0) return { error: t.common.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cookbook_recipes")
    .upsert(ids.map((recipe_id) => ({ cookbook_id: cookbook.id, recipe_id, added_by: user.id })), {
      onConflict: "cookbook_id,recipe_id",
      ignoreDuplicates: true,
    });
  if (error) return { error: t.common.error };

  revalidatePath("/", "layout");
  return undefined;
}

/** Removes a recipe from a collection. The recipe itself is not deleted. */
export async function removeFromCookbook(cookbookId: string, recipeId: string): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const cookbook = (await getMyCookbooks()).find((b) => b.id === cookbookId && !b.is_default);
  if (!cookbook || !isUuid(recipeId)) return { error: t.common.error };
  const supabase = await createClient();
  const { error } = await supabase.from("cookbook_recipes").delete().eq("cookbook_id", cookbook.id).eq("recipe_id", recipeId);
  if (error) return { error: t.common.error };
  revalidatePath("/", "layout");
  return undefined;
}

/** Copies a recipe (including its images) as the user's own recipe and opens it for editing. */
export async function copyRecipe(sourceId: string): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const user = await getCurrentUser();
  const source = await getRecipe(sourceId);
  if (!source) return { error: t.common.error };

  const supabase = await createClient();
  const newId = crypto.randomUUID();
  const { error } = await supabase.from("recipes").insert({
    id: newId,
    owner_id: user.id,
    family_id: source.family_id,
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
    language: source.language,
    origin: source.origin,
    story: source.story,
  });
  if (error) return { error: t.common.error };

  const copies = [];
  for (const img of source.images) {
    const fileName = img.storage_path.split("/").pop();
    const path = `${source.family_id}/${newId}/${fileName}`;
    const { error: copyError } = await supabase.storage.from(IMAGE_BUCKET).copy(img.storage_path, path);
    if (!copyError) {
      copies.push({
        recipe_id: newId,
        family_id: source.family_id,
        storage_path: path,
        role: img.role,
        sort_order: img.sort_order,
        is_cover: img.is_cover,
      });
    }
  }
  if (copies.length) await supabase.from("recipe_images").insert(copies);

  revalidatePath("/", "layout");
  redirect(`/recipes/${newId}/edit`);
}

export async function deleteRecipe(id: string) {
  const recipe = await getRecipe(id);
  if (!recipe?.canEdit) return;
  const supabase = await createClient();

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
  if (recipe.images.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove(recipe.images.map((img) => img.storage_path));
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
    language: isLocale(draft.language) ? draft.language : null,
    origin: (draft.origin ?? "").trim().slice(0, 200),
    story: (draft.story ?? "").trim().slice(0, 5000),
  };
}
