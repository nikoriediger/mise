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

export type RecipeWithImages = Recipe & { images: RecipeImage[] };

export type RecipeListItem = Pick<
  Recipe,
  "id" | "title" | "category" | "tags" | "prep_minutes" | "cook_minutes"
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

export type Membership = {
  cookbook_id: string;
  role: "owner" | "member";
  cookbook_name: string;
};

export const IMAGE_BUCKET = "recipe-images";
