import type { ComponentType } from "react";
import type { RecipeDraft } from "@/lib/types";

export type RecipeFormToolProps = {
  /** Fills the form with the given values and adds the files as original-recipe scans. */
  onPrefill: (draft: Partial<RecipeDraft>, sourceFiles: File[]) => void;
};

/**
 * Optional tools shown above the recipe form (must be Client Components).
 * Empty in the core app; extended versions can register their own tools here.
 */
export const recipeFormTools: ComponentType<RecipeFormToolProps>[] = [];
