import Link from "next/link";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RecipeList } from "@/components/recipe-list";
import { listRecipes } from "@/lib/data";
import { t } from "@/i18n";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Recipes />
    </Suspense>
  );
}

async function Recipes() {
  const recipes = await listRecipes();

  if (recipes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-muted">{t.recipes.empty}</p>
        <Link href="/recipes/new" className="btn-primary">{t.recipes.emptyCta}</Link>
      </div>
    );
  }
  return <RecipeList recipes={recipes} />;
}
