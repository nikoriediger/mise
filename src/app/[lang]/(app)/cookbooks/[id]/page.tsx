import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditCookbookButton } from "@/components/cookbook-controls";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { RecipeList } from "@/components/recipe-list";
import { RecipePickerButton } from "@/components/recipe-picker-button";
import { getCookbook, listRecipes } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export default function CookbookPage({ params }: PageProps<"/[lang]/cookbooks/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <CookbookDetail params={params} />
    </Suspense>
  );
}

async function CookbookDetail({ params }: Pick<PageProps<"/[lang]/cookbooks/[id]">, "params">) {
  const { t, p, f } = await getI18n();
  const { id } = await params;
  const cookbook = await getCookbook(id);
  if (!cookbook) notFound();
  const isCollection = !cookbook.is_default;
  const canManage = cookbook.is_mine && isCollection;

  const [recipes, all] = await Promise.all([listRecipes(cookbook.id), canManage ? listRecipes() : Promise.resolve([])]);
  const inBook = new Set(recipes.map((r) => r.id));
  const candidates = all.filter((r) => !inBook.has(r.id) && r.family_id === cookbook.family_id);
  const newRecipeHref = isCollection ? `/recipes/new?cookbook=${cookbook.id}` : "/recipes/new";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-sage-100 to-mint-200 text-4xl shadow-soft">
          {cookbook.emoji}
        </span>
        <div className="mr-auto min-w-0">
          <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{cookbook.name}</h1>
          <p className="text-sm text-muted">
            {[
              cookbook.is_default && (cookbook.is_mine ? t.cookbooks.mainHint : t.cookbooks.main),
              !cookbook.is_mine && cookbook.owner_name && f(t.recipes.byOwner, { name: cookbook.owner_name }),
              p(t.recipes.count, recipes.length),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {cookbook.is_mine && (
          <div className="flex flex-wrap gap-2">
            <EditCookbookButton cookbook={cookbook} />
            {canManage && <RecipePickerButton cookbookId={cookbook.id} cookbookName={cookbook.name} candidates={candidates} />}
            <Link href={newRecipeHref} className="btn-primary">+ {t.cookbooks.newRecipe}</Link>
          </div>
        )}
      </div>

      {!cookbook.is_mine && (
        <p className="rounded-2xl bg-mint-100/80 px-4 py-3 text-sm text-forest-800">{f(t.cookbooks.readOnly, { name: cookbook.owner_name || "…" })}</p>
      )}

      {recipes.length ? (
        <RecipeList recipes={recipes} cookbooks={[cookbook]} standalone={false} removableFrom={canManage ? cookbook.id : undefined} />
      ) : (
        <EmptyState text={t.cookbooks.empty} href={cookbook.is_mine ? newRecipeHref : undefined} cta={t.cookbooks.newRecipe} />
      )}
    </div>
  );
}
