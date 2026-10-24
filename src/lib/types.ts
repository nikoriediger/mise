export type ImageRole = "gallery" | "source";

export type Recipe = {
  id: string;
  cookbook_id: string;
  title: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: string[];
  steps: string[];
  notes: string | null;
  category: string | null;
  tags: string[];
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

/** A cookbook as shown in the UI, with its owner's display name. */
export type Cookbook = {
  id: string;
  family_id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  emoji: string;
  is_mine: boolean;
  recipe_count: number;
};

export type RecipeWithImages = Recipe & {
  images: RecipeImage[];
  cookbook: Cookbook;
  /** True if the current user owns the recipe's cookbook. */
  canEdit: boolean;
};

export type RecipeListItem = Pick<
  Recipe,
  "id" | "title" | "category" | "tags" | "prep_minutes" | "cook_minutes" | "cookbook_id"
> & { coverUrl: string | null };

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
};

export type FamilyMembership = {
  family_id: string;
  role: "owner" | "member";
  family_name: string;
};

export const IMAGE_BUCKET = "recipe-images";

export const COOKBOOK_EMOJIS = ["📗", "📘", "📙", "📕", "📒", "🍰", "🥘", "🍝", "🥗", "🍲", "🥐", "🎄", "🌶️", "🍹"];
