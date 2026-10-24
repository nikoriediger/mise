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

  const cookbooks = mine.filter((b) => b.family_id === recipe.family_id);
  const inCollections = recipe.cookbooks.filter((b) => b.is_mine && !b.is_default).map((b) => b.id);
  return (
    <RecipeForm
      key={recipe.updated_at}
      familyId={recipe.family_id}
      cookbooks={cookbooks}
      initialCollectionIds={inCollections}
      recipe={recipe}
    />
  );
}
