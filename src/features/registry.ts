import type { ComponentType } from "react";
import type { RecipeDraft } from "@/lib/types";

export type RecipeFormToolProps = {
  /** Fills the form with the given values and adds the files as original-recipe scans. */
  onPrefill: (draft: Partial<RecipeDraft>, sourceFiles: File[]) => void;
};

export type IngredientActionProps = {
  /** The ingredient line as shown (already scaled to the selected servings). */
  ingredient: string;
  recipe: { title: string; ingredients: string[]; steps: string[]; servings: number | null };
};

/**
 * Optional tools shown above the recipe form (must be Client Components).
 * Empty in the core app; extended versions can register their own tools here.
 */
export const recipeFormTools: ComponentType<RecipeFormToolProps>[] = [];

/**
 * Optional actions shown next to each ingredient on the recipe page (must be
 * Client Components). Empty in the core app.
 */
export const ingredientActions: ComponentType<IngredientActionProps>[] = [];
