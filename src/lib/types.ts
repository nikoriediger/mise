import type { Locale } from "@/i18n/config";

export type ImageRole = "gallery" | "source" | "memory";

export type Recipe = {
  id: string;
  owner_id: string;
  family_id: string;
  title: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: string[];
  steps: string[];
  notes: string | null;
  category: string | null;
  tags: string[];
  /** Language of the recipe's content (de/en/it), if known. */
  language: Locale | null;
  origin: string | null;
  story: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeImage = {
  id: string;
  recipe_id: string;
  storage_path: string;
  role: ImageRole;
  sort_order: number;
  is_cover: boolean;
  url: string;
};

/**
 * A cookbook as shown in the UI. The main cookbook (is_default) automatically
 * contains all of its owner's recipes; other cookbooks are collections.
 */
export type Cookbook = {
  id: string;
  family_id: string;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  name: string;
  emoji: string;
  is_default: boolean;
  is_mine: boolean;
  recipe_count: number;
};

export type CookbookWithCover = Cookbook & { coverUrl: string | null };

export type RecipeWithImages = Recipe & {
  images: RecipeImage[];
  owner_name: string;
  owner_avatar: string | null;
  /** True if the current user owns the recipe. */
  canEdit: boolean;
  is_favorite: boolean;
  /** All cookbooks (visible to the user) that contain this recipe. */
  cookbooks: Cookbook[];
};

export type RecipeListItem = Pick<
  Recipe,
  "id" | "title" | "category" | "tags" | "prep_minutes" | "cook_minutes" | "owner_id" | "family_id" | "ingredients" | "language"
> & {
  owner_name: string;
  owner_avatar: string | null;
  is_mine: boolean;
  is_favorite: boolean;
  /** When the current user last cooked it (yyyy-mm-dd), if ever. */
  last_cooked: string | null;
  /** Cookbooks containing the recipe (main cookbook of the owner + collections). */
  cookbook_ids: string[];
  coverUrl: string | null;
};

/** The editable fields of a recipe, as used by the form (and form extensions). */
export type RecipeDraft = {
  title: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: string[];
  steps: string[];
  notes: string;
  category: string;
  tags: string[];
  language: Locale | null;
  origin: string;
  story: string;
};

export type FamilyMembership = {
  family_id: string;
  role: "owner" | "member";
  family_name: string;
};

export const IMAGE_BUCKET = "recipe-images";
export const AVATAR_BUCKET = "avatars";

export type Profile = {
  user_id: string;
  display_name: string;
  bio: string;
  avatar_path: string | null;
  avatar_url: string | null;
  notify_notes: boolean;
  notify_new_recipes: boolean;
};

export const COOKBOOK_EMOJIS = ["📗", "📘", "📙", "📕", "📒", "🍰", "🥘", "🍝", "🥗", "🍲", "🥐", "🎄", "🌶️", "🍹"];
