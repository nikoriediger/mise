import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_BUCKET,
  type Membership,
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

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cookbook_members")
    .select("cookbook_id, role, cookbooks(name)")
    .eq("user_id", user.id)
    .order("joined_at");
  if (error) throw error;
  return data.map((m) => ({
    cookbook_id: m.cookbook_id,
    role: m.role,
    cookbook_name: (m.cookbooks as unknown as { name: string } | null)?.name ?? "",
  }));
});

/** The cookbook new recipes are added to: the user's first cookbook. */
export async function getPrimaryCookbook(): Promise<Membership> {
  const memberships = await getMemberships();
  if (memberships.length === 0) {
    throw new Error("User is not a member of any cookbook");
  }
  return memberships[0];
}

export async function listRecipes(): Promise<RecipeListItem[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, category, tags, prep_minutes, cook_minutes, recipe_images(storage_path, role, is_cover, sort_order)")
    .order("title");
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
    coverUrl: urls.get(coverPaths.get(recipe.id) ?? "") ?? null,
  }));
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
  const sorted = [...recipe_images].sort((a, b) => a.sort_order - b.sort_order);
  const urls = await signUrls(sorted.map((img) => img.storage_path));

  return {
    ...recipe,
    images: sorted.map((img) => ({ ...img, url: urls.get(img.storage_path) ?? "" })),
  };
}

export type Member = {
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
};

export type Invite = { token: string; expires_at: string };

export async function getCookbookDetails() {
  const cookbook = await getPrimaryCookbook();
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("cookbook_members")
    .select("user_id, role, display_name")
    .eq("cookbook_id", cookbook.cookbook_id)
    .order("joined_at");
  if (error) throw error;

  let invites: Invite[] = [];
  if (cookbook.role === "owner") {
    const { data, error: inviteError } = await supabase
      .from("invites")
      .select("token, expires_at")
      .eq("cookbook_id", cookbook.cookbook_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at");
    if (inviteError) throw inviteError;
    invites = data;
  }

  return { cookbook, members: members as Member[], invites };
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
