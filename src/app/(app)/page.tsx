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
      <div className="card mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-mint-200 text-3xl shadow-soft">🥣</span>
        <p className="text-muted">{t.recipes.empty}</p>
        <Link href="/recipes/new" className="btn-primary">{t.recipes.emptyCta}</Link>
      </div>
    );
  }
  return <RecipeList recipes={recipes} />;
}
