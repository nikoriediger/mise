import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AVATAR_BUCKET,
  IMAGE_BUCKET,
  type Profile,
  type Cookbook,
  type CookbookWithCover,
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

/**
 * Everything needed to place recipes in cookbooks, loaded once per request:
 * cookbooks with counts, member names, and which cookbooks contain which recipe.
 */
const getLibrary = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [books, members, recipes, links, profiles, favorites, myCooking] = await Promise.all([
    supabase.from("cookbooks").select("id, family_id, owner_id, name, emoji, is_default, created_at").order("created_at"),
    supabase.from("family_members").select("family_id, user_id, display_name"),
    supabase.from("recipes").select("id, owner_id, family_id"),
    supabase.from("cookbook_recipes").select("cookbook_id, recipe_id"),
    supabase.from("profiles").select("user_id, display_name, avatar_path"),
    supabase.from("favorites").select("recipe_id"),
    supabase.from("cook_log").select("recipe_id, cooked_on").eq("user_id", user.id).order("cooked_on", { ascending: false }),
  ]);
  for (const r of [books, members, recipes, links, profiles, favorites, myCooking]) if (r.error) throw r.error;
  const favoriteIds = new Set(favorites.data!.map((f) => f.recipe_id));
  const lastCooked = new Map<string, string>();
  for (const c of myCooking.data!) if (!lastCooked.has(c.recipe_id)) lastCooked.set(c.recipe_id, c.cooked_on);

  const names = new Map(members.data!.map((m) => [`${m.family_id}:${m.user_id}`, m.display_name ?? ""]));
  const profileName = new Map(profiles.data!.map((p) => [p.user_id, p.display_name ?? ""]));
  const ownerName = (familyId: string, userId: string) => profileName.get(userId) || names.get(`${familyId}:${userId}`) || "";
  const avatarPaths = new Map(profiles.data!.filter((p) => p.avatar_path).map((p) => [p.user_id, p.avatar_path as string]));
  const avatarUrls = await signUrls([...avatarPaths.values()], AVATAR_BUCKET);
  const avatarOf = (userId: string) => avatarUrls.get(avatarPaths.get(userId) ?? "") ?? null;

  const mainBook = new Map<string, string>(); // family:owner -> main cookbook id
  for (const b of books.data!) if (b.is_default) mainBook.set(`${b.family_id}:${b.owner_id}`, b.id);

  const membership = new Map<string, string[]>(); // recipe id -> cookbook ids
  for (const r of recipes.data!) {
    const main = mainBook.get(`${r.family_id}:${r.owner_id}`);
    membership.set(r.id, main ? [main] : []);
  }
  const linkCount = new Map<string, number>();
  for (const l of links.data!) {
    membership.get(l.recipe_id)?.push(l.cookbook_id);
    linkCount.set(l.cookbook_id, (linkCount.get(l.cookbook_id) ?? 0) + 1);
  }

  const cookbooks: Cookbook[] = books.data!
    .map((b) => ({
      id: b.id,
      family_id: b.family_id,
      owner_id: b.owner_id,
      owner_name: ownerName(b.family_id, b.owner_id),
      owner_avatar: avatarOf(b.owner_id),
      name: b.name,
      emoji: b.emoji,
      is_default: b.is_default,
      is_mine: b.owner_id === user.id,
      recipe_count: b.is_default
        ? recipes.data!.filter((r) => r.owner_id === b.owner_id && r.family_id === b.family_id).length
        : (linkCount.get(b.id) ?? 0),
    }))
    // Own cookbooks first (main cookbook first), then the family's
    .sort((a, b) => Number(b.is_mine) - Number(a.is_mine) || Number(b.is_default) - Number(a.is_default));

  return { user, cookbooks, membership, ownerName, avatarOf, favoriteIds, lastCooked };
});

/** All cookbooks the user can see (their families' cookbooks), own ones first. */
export async function getCookbooks(): Promise<Cookbook[]> {
  return (await getLibrary()).cookbooks;
}

export async function getMyCookbooks(): Promise<Cookbook[]> {
  return (await getCookbooks()).filter((b) => b.is_mine);
}

export async function getCookbook(id: string): Promise<Cookbook | null> {
  if (!isUuid(id)) return null;
  return (await getCookbooks()).find((b) => b.id === id) ?? null;
}

/** Cookbooks with a cover image: the first recipe (by title) that has a photo. */
export async function getCookbooksWithCovers(): Promise<CookbookWithCover[]> {
  const { cookbooks, membership } = await getLibrary();
  const supabase = await createClient();
  const [{ data: images, error }, { data: titles, error: titleError }] = await Promise.all([
    supabase.from("recipe_images").select("recipe_id, storage_path, is_cover, sort_order").eq("role", "gallery"),
    supabase.from("recipes").select("id, title").order("title"),
  ]);
  if (error) throw error;
  if (titleError) throw titleError;

  const imageOf = new Map<string, string>();
  for (const img of [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)) {
    if (!imageOf.has(img.recipe_id)) imageOf.set(img.recipe_id, img.storage_path);
  }
  const coverPath = new Map<string, string>();
  for (const r of titles) {
    const path = imageOf.get(r.id);
    if (!path) continue;
    for (const bookId of membership.get(r.id) ?? []) if (!coverPath.has(bookId)) coverPath.set(bookId, path);
  }
  const urls = await signUrls([...new Set(coverPath.values())]);
  return cookbooks.map((b) => ({ ...b, coverUrl: urls.get(coverPath.get(b.id) ?? "") ?? null }));
}

/** Recipes of all families, or only those in one cookbook. */
export async function listRecipes(cookbookId?: string): Promise<RecipeListItem[]> {
  const { user, cookbooks, membership, ownerName, avatarOf, favoriteIds, lastCooked } = await getLibrary();
  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("id, title, category, tags, prep_minutes, cook_minutes, owner_id, family_id, ingredients, language, recipe_images(storage_path, role, is_cover, sort_order)")
    .order("title");

  if (cookbookId) {
    const book = cookbooks.find((b) => b.id === cookbookId);
    if (!book) return [];
    query = book.is_default
      ? query.eq("owner_id", book.owner_id).eq("family_id", book.family_id)
      : query.in("id", [...membership].filter(([, ids]) => ids.includes(book.id)).map(([id]) => id));
  }
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
    owner_id: recipe.owner_id,
    family_id: recipe.family_id,
    ingredients: recipe.ingredients,
    language: recipe.language,
    owner_name: ownerName(recipe.family_id, recipe.owner_id),
    owner_avatar: avatarOf(recipe.owner_id),
    is_mine: recipe.owner_id === user.id,
    is_favorite: favoriteIds.has(recipe.id),
    last_cooked: lastCooked.get(recipe.id) ?? null,
    cookbook_ids: membership.get(recipe.id) ?? [],
    coverUrl: urls.get(coverPaths.get(recipe.id) ?? "") ?? null,
  }));
}

/** Titles and authors of all visible recipes, for the duplicate hint on the recipe form. */
export async function listRecipeTitles(): Promise<{ id: string; title: string; owner_name: string }[]> {
  const { ownerName } = await getLibrary();
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("id, title, owner_id, family_id");
  if (error) throw error;
  return data.map((r) => ({ id: r.id, title: r.title, owner_name: ownerName(r.family_id, r.owner_id) }));
}

export async function getRecipe(id: string): Promise<RecipeWithImages | null> {
  if (!isUuid(id)) return null;
  const { user, cookbooks, membership, ownerName, avatarOf, favoriteIds } = await getLibrary();
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
  const inBooks = membership.get(recipe.id) ?? [];

  return {
    ...recipe,
    images: sorted.map((img) => ({ ...img, url: urls.get(img.storage_path) ?? "" })),
    owner_name: ownerName(recipe.family_id, recipe.owner_id),
    owner_avatar: avatarOf(recipe.owner_id),
    canEdit: recipe.owner_id === user.id,
    is_favorite: favoriteIds.has(recipe.id),
    cookbooks: cookbooks.filter((b) => inBooks.includes(b.id)),
  };
}

/** The signed-in user's own profile. */
export async function getMyProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, bio, avatar_path, notify_notes, notify_new_recipes")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  const profile = data ?? { user_id: user.id, display_name: "", bio: "", avatar_path: null, notify_notes: false, notify_new_recipes: false };
  const urls = profile.avatar_path ? await signUrls([profile.avatar_path], AVATAR_BUCKET) : new Map<string, string>();
  return { ...profile, display_name: profile.display_name ?? "", avatar_url: urls.get(profile.avatar_path ?? "") ?? null };
}

export type RecipeNote = {
  id: string;
  body: string;
  author_name: string;
  author_avatar: string | null;
  created_at: string;
  edited: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export async function getRecipeNotes(recipe: Pick<RecipeWithImages, "id" | "family_id" | "canEdit">): Promise<RecipeNote[]> {
  const { user, ownerName, avatarOf } = await getLibrary();
  const families = await getFamilyMemberships();
  const isAdmin = families.some((f) => f.family_id === recipe.family_id && f.role === "owner");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_notes")
    .select("id, body, author_id, created_at, updated_at")
    .eq("recipe_id", recipe.id)
    .order("created_at");
  if (error) throw error;
  return data.map((n) => ({
    id: n.id,
    body: n.body,
    author_name: ownerName(recipe.family_id, n.author_id),
    author_avatar: avatarOf(n.author_id),
    created_at: n.created_at,
    edited: new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 1000,
    canEdit: n.author_id === user.id,
    canDelete: n.author_id === user.id || recipe.canEdit || isAdmin,
  }));
}

export type BookRecipe = Recipe & { coverUrl: string | null };

/** All recipes of a cookbook with their full content, for the printable book. */
export async function getCookbookRecipesFull(cookbookId: string): Promise<BookRecipe[]> {
  const { cookbooks, membership } = await getLibrary();
  const book = cookbooks.find((b) => b.id === cookbookId);
  if (!book) return [];
  const supabase = await createClient();
  let query = supabase.from("recipes").select("*, recipe_images(storage_path, role, is_cover, sort_order)").order("title");
  query = book.is_default
    ? query.eq("owner_id", book.owner_id).eq("family_id", book.family_id)
    : query.in("id", [...membership].filter(([, ids]) => ids.includes(book.id)).map(([id]) => id));
  const { data, error } = await query;
  if (error) throw error;

  type Row = Recipe & { recipe_images: { storage_path: string; role: string; is_cover: boolean; sort_order: number }[] };
  const rows = data as Row[];
  const covers = new Map<string, string>();
  for (const r of rows) {
    const img = r.recipe_images.filter((i) => i.role === "gallery").sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
    if (img) covers.set(r.id, img.storage_path);
  }
  const urls = await signUrls([...covers.values()]);
  return rows.map((row) => {
    const recipe: Partial<Row> = { ...row };
    delete recipe.recipe_images;
    return { ...(recipe as Recipe), coverUrl: urls.get(covers.get(row.id) ?? "") ?? null };
  });
}

export type ShoppingItem = {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  sources: string[];
  checked: boolean;
  list: "mine" | "family";
};

/** Items of the user's personal list and the family list. */
export async function listShoppingItems(): Promise<ShoppingItem[]> {
  const user = await getCurrentUser();
  const family = await getPrimaryFamily();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_items")
    .select("id, name, amount, unit, sources, checked, owner_id")
    .eq("family_id", family.family_id)
    .order("created_at");
  if (error) throw error;
  return data.map((i) => ({
    id: i.id,
    name: i.name,
    amount: i.amount === null ? null : Number(i.amount),
    unit: i.unit,
    sources: i.sources,
    checked: i.checked,
    list: i.owner_id === user.id ? "mine" : "family",
  }));
}

export type PlannedMeal = {
  id: string;
  planned_on: string;
  servings: number | null;
  recipe: { id: string; title: string; servings: number | null; coverUrl: string | null };
};

/** The user's meal plan between two days (inclusive). */
export async function listMealPlan(from: string, to: string): Promise<PlannedMeal[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan")
    .select("id, planned_on, servings, recipes(id, title, servings, recipe_images(storage_path, role, is_cover, sort_order))")
    .eq("user_id", user.id)
    .gte("planned_on", from)
    .lte("planned_on", to)
    .order("created_at");
  if (error) throw error;

  type Row = { id: string; title: string; servings: number | null; recipe_images: { storage_path: string; role: string; is_cover: boolean; sort_order: number }[] };
  const covers = new Map<string, string>();
  for (const entry of data) {
    const r = entry.recipes as unknown as Row | null;
    const img = r?.recipe_images.filter((i) => i.role === "gallery").sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
    if (r && img) covers.set(r.id, img.storage_path);
  }
  const urls = await signUrls([...covers.values()]);
  return data.flatMap((entry) => {
    const r = entry.recipes as unknown as Row | null;
    if (!r) return [];
    return [{ id: entry.id, planned_on: entry.planned_on, servings: entry.servings, recipe: { id: r.id, title: r.title, servings: r.servings, coverUrl: urls.get(covers.get(r.id) ?? "") ?? null } }];
  });
}

export type CookLogEntry = {
  id: string;
  cooked_on: string;
  rating: number | null;
  comment: string;
  photo_url: string | null;
  author_name: string;
  author_avatar: string | null;
  canDelete: boolean;
};

/** The cooking diary of a recipe, newest first. */
export async function getCookLog(recipe: Pick<RecipeWithImages, "id" | "family_id">): Promise<CookLogEntry[]> {
  const { user, ownerName, avatarOf } = await getLibrary();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cook_log")
    .select("id, user_id, cooked_on, rating, comment, photo_path")
    .eq("recipe_id", recipe.id)
    .order("cooked_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const urls = await signUrls(data.map((e) => e.photo_path).filter((p): p is string => Boolean(p)));
  return data.map((e) => ({
    id: e.id,
    cooked_on: e.cooked_on,
    rating: e.rating,
    comment: e.comment,
    photo_url: e.photo_path ? (urls.get(e.photo_path) ?? null) : null,
    author_name: ownerName(recipe.family_id, e.user_id),
    author_avatar: avatarOf(e.user_id),
    canDelete: e.user_id === user.id,
  }));
}

export type Member = {
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
  avatar_url: string | null;
  bio: string;
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

  const { avatarOf } = await getLibrary();
  const { data: bios } = await supabase.from("profiles").select("user_id, bio");
  const bioOf = new Map((bios ?? []).map((b) => [b.user_id, b.bio]));
  return {
    family,
    members: members.map((m) => ({ ...m, avatar_url: avatarOf(m.user_id), bio: bioOf.get(m.user_id) ?? "" })) as Member[],
    invites,
  };
}

async function signUrls(paths: string[], bucket = IMAGE_BUCKET): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
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
