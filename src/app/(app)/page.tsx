import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { RecipeList } from "@/components/recipe-list";
import { getCookbooks, listRecipes } from "@/lib/data";
import { t } from "@/i18n";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Recipes />
    </Suspense>
  );
}

async function Recipes() {
  const [recipes, cookbooks] = await Promise.all([listRecipes(), getCookbooks()]);

  if (recipes.length === 0) {
    return <EmptyState text={t.recipes.empty} href="/recipes/new" />;
  }
  return <RecipeList recipes={recipes} cookbooks={cookbooks} />;
}
