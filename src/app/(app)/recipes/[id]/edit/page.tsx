import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RecipeForm } from "@/components/recipe-form";
import { getRecipe } from "@/lib/data";
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
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return <RecipeForm key={recipe.updated_at} cookbookId={recipe.cookbook_id} recipe={recipe} />;
}
