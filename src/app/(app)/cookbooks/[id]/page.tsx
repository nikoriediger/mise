import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditCookbookButton } from "@/components/cookbook-controls";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { RecipeList } from "@/components/recipe-list";
import { getCookbook, listRecipes } from "@/lib/data";
import { t } from "@/i18n";

export default function CookbookPage({ params }: PageProps<"/cookbooks/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <CookbookDetail params={params} />
    </Suspense>
  );
}

async function CookbookDetail({ params }: Pick<PageProps<"/cookbooks/[id]">, "params">) {
  const { id } = await params;
  const cookbook = await getCookbook(id);
  if (!cookbook) notFound();
  const recipes = await listRecipes(cookbook.id);
  const newRecipeHref = `/recipes/new?cookbook=${cookbook.id}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-sage-100 to-mint-200 text-4xl shadow-soft">
          {cookbook.emoji}
        </span>
        <div className="mr-auto min-w-0">
          <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{cookbook.name}</h1>
          <p className="text-sm text-muted">
            {[!cookbook.is_mine && cookbook.owner_name && t.recipes.byOwner(cookbook.owner_name), t.recipes.count(recipes.length)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {cookbook.is_mine && (
          <div className="flex gap-2">
            <EditCookbookButton cookbook={cookbook} />
            <Link href={newRecipeHref} className="btn-primary">+ {t.cookbooks.addRecipe}</Link>
          </div>
        )}
      </div>

      {!cookbook.is_mine && (
        <p className="rounded-2xl bg-mint-100/80 px-4 py-3 text-sm text-forest-800">{t.cookbooks.readOnly(cookbook.owner_name || "…")}</p>
      )}

      {recipes.length ? (
        <RecipeList recipes={recipes} cookbooks={[cookbook]} standalone={false} />
      ) : (
        <EmptyState text={t.cookbooks.empty} href={cookbook.is_mine ? newRecipeHref : undefined} cta={t.cookbooks.addRecipe} />
      )}
    </div>
  );
}
