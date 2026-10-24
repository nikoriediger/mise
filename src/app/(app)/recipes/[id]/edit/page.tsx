import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RecipeForm } from "@/components/recipe-form";
import { getMyCookbooks, getRecipe } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.form.editTitle };

export default function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  return (
    <Suspense fallback={<Loading />}>
      <EditRecipe params={params} />
    </Suspense>
  );
}

async function EditRecipe({ params }: Pick<PageProps<"/recipes/[id]/edit">, "params">) {
  const { id } = await params;
  const [recipe, mine] = await Promise.all([getRecipe(id), getMyCookbooks()]);
  if (!recipe?.canEdit) notFound();

  // Recipes can only move between own cookbooks of the same family (images live in the family folder).
  const cookbooks = mine.filter((b) => b.family_id === recipe.cookbook.family_id);
  return (
    <RecipeForm
      key={recipe.updated_at}
      cookbooks={cookbooks}
      initialCookbookId={recipe.cookbook_id}
      recipe={recipe}
    />
  );
}
