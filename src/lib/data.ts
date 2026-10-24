import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_BUCKET,
  type Cookbook,
  type FamilyMembership,
  type Recipe,
  type RecipeImage,
  type RecipeListItem,
  type RecipeWithImages,
} from "@/lib/types";

const SIGNED_URL_SECONDS = 60 * 60;

/** The signed-in user, or a redirect to /login. Deduplicated per request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login");
  }
  return { id: data.user.id, email: data.user.email ?? "" };
});

export const getFamilyMemberships = cache(async (): Promise<FamilyMembership[]> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id, role, families(name)")
    .eq("user_id", user.id)
    .order("joined_at");
  if (error) throw error;
  return data.map((m) => ({
    family_id: m.family_id,
    role: m.role,
    family_name: (m.families as unknown as { name: string } | null)?.name ?? "",
  }));
});

/** The user's (first) family. */
export async function getPrimaryFamily(): Promise<FamilyMembership> {
  const memberships = await getFamilyMemberships();
  if (memberships.length === 0) {
    throw new Error("User is not a member of any family");
  }
  return memberships[0];
}

/** All cookbooks the user can see (their families' cookbooks), own ones first. */
export const getCookbooks = cache(async (): Promise<Cookbook[]> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: books, error }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("cookbooks").select("id, family_id, owner_id, name, emoji, created_at, recipes(count)").order("created_at"),
    supabase.from("family_members").select("family_id, user_id, display_name"),
  ]);
  if (error) throw error;
  if (membersError) throw membersError;

  const names = new Map(members.map((m) => [`${m.family_id}:${m.user_id}`, m.display_name ?? ""]));
  return books
    .map((b) => ({
      id: b.id,
      family_id: b.family_id,
      owner_id: b.owner_id,
      owner_name: names.get(`${b.family_id}:${b.owner_id}`) ?? "",
      name: b.name,
      emoji: b.emoji,
      is_mine: b.owner_id === user.id,
      recipe_count: (b.recipes as unknown as { count: number }[])[0]?.count ?? 0,
    }))
    .sort((a, b) => Number(b.is_mine) - Number(a.is_mine));
});

export async function getMyCookbooks(): Promise<Cookbook[]> {
  return (await getCookbooks()).filter((b) => b.is_mine);
}

export async function getCookbook(id: string): Promise<Cookbook | null> {
  if (!isUuid(id)) return null;
  return (await getCookbooks()).find((b) => b.id === id) ?? null;
}

export async function listRecipes(cookbookId?: string): Promise<RecipeListItem[]> {
  await getCurrentUser();
  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("id, title, category, tags, prep_minutes, cook_minutes, cookbook_id, recipe_images(storage_path, role, is_cover, sort_order)")
    .order("title");
  if (cookbookId) query = query.eq("cookbook_id", cookbookId);
  const { data, error } = await query;
  if (error) throw error;

  const coverPaths = new Map<string, string>();
  for (const recipe of data) {
    const gallery = (recipe.recipe_images ?? [])
      .filter((img) => img.role === "gallery")
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    if (gallery[0]) coverPaths.set(recipe.id, gallery[0].storage_path);
  }
  const urls = await signUrls([...coverPaths.values()]);

  return data.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    tags: recipe.tags,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    cookbook_id: recipe.cookbook_id,
    coverUrl: urls.get(coverPaths.get(recipe.id) ?? "") ?? null,
  }));
}

/** Titles of all visible recipes, for the duplicate hint on the recipe form. */
export async function listRecipeTitles(): Promise<{ id: string; title: string; cookbook_id: string }[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("id, title, cookbook_id");
  if (error) throw error;
  return data;
}

export async function getRecipe(id: string): Promise<RecipeWithImages | null> {
  await getCurrentUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_images(id, recipe_id, storage_path, role, sort_order, is_cover)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { recipe_images, ...recipe } = data as Recipe & {
    recipe_images: Omit<RecipeImage, "url">[];
  };
  const cookbook = await getCookbook(recipe.cookbook_id);
  if (!cookbook) return null;

  const sorted = [...recipe_images].sort((a, b) => a.sort_order - b.sort_order);
  const urls = await signUrls(sorted.map((img) => img.storage_path));

  return {
    ...recipe,
    images: sorted.map((img) => ({ ...img, url: urls.get(img.storage_path) ?? "" })),
    cookbook,
    canEdit: cookbook.is_mine,
  };
}

export type Member = {
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
};

export type Invite = { token: string; expires_at: string };

export async function getFamilyDetails() {
  const family = await getPrimaryFamily();
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("family_members")
    .select("user_id, role, display_name")
    .eq("family_id", family.family_id)
    .order("joined_at");
  if (error) throw error;

  let invites: Invite[] = [];
  if (family.role === "owner") {
    const { data, error: inviteError } = await supabase
      .from("invites")
      .select("token, expires_at")
      .eq("family_id", family.family_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at");
    if (inviteError) throw inviteError;
    invites = data;
  }

  return { family, members: members as Member[], invites };
}

async function signUrls(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  for (const item of data) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
