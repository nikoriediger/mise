import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RecipeForm } from "@/components/recipe-form";
import { getPrimaryCookbook } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.form.newTitle };

export default function NewRecipePage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewRecipe />
    </Suspense>
  );
}

async function NewRecipe() {
  const cookbook = await getPrimaryCookbook();
  return <RecipeForm cookbookId={cookbook.cookbook_id} />;
}
