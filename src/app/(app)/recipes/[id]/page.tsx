import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CookbookBadge } from "@/components/cookbook-badge";
import { CopyRecipeButton } from "@/components/copy-recipe-button";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { ImageGallery } from "@/components/image-gallery";
import { Loading } from "@/components/loading";
import { getMyCookbooks, getRecipe } from "@/lib/data";
import { t } from "@/i18n";

export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <RecipeDetail params={params} />
    </Suspense>
  );
}

async function RecipeDetail({ params }: Pick<PageProps<"/recipes/[id]">, "params">) {
  const { id } = await params;
  const [recipe, myCookbooks] = await Promise.all([getRecipe(id), getMyCookbooks()]);
  if (!recipe) notFound();

  const gallery = recipe.images
    .filter((img) => img.role === "gallery")
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
  const sources = recipe.images.filter((img) => img.role === "source");
  const facts = [
    recipe.servings && { label: t.recipes.servings, value: String(recipe.servings) },
    recipe.prep_minutes && { label: t.recipes.prepTime, value: `${recipe.prep_minutes} ${t.common.minutes}` },
    recipe.cook_minutes && { label: t.recipes.cookTime, value: `${recipe.cook_minutes} ${t.common.minutes}` },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <article className="space-y-10">
      <div className="flex flex-wrap items-start gap-4">
        <div className="mr-auto min-w-0">
          {recipe.category && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-moss-600">{recipe.category}</p>
          )}
          <h1 className="font-serif text-4xl font-semibold leading-tight text-forest-900 sm:text-5xl">{recipe.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            {t.recipes.fromCookbook} <CookbookBadge cookbook={recipe.cookbook} link className="text-sm" />
            {!recipe.canEdit && recipe.cookbook.owner_name && <span>· {t.recipes.byOwner(recipe.cookbook.owner_name)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recipe.canEdit ? (
            <>
              <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">{t.common.edit}</Link>
              <DeleteRecipeButton id={recipe.id} />
            </>
          ) : (
            <CopyRecipeButton recipeId={recipe.id} cookbooks={myCookbooks} primary />
          )}
        </div>
      </div>

      {facts.length > 0 && (
        <dl className="flex flex-wrap gap-3">
          {facts.map((f) => (
            <div key={f.label} className="card px-4 py-2.5">
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className="font-semibold text-forest-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {gallery.length > 0 && <ImageGallery images={gallery} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {recipe.ingredients.length > 0 && (
          <section className="card h-fit p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.recipes.ingredients}</h2>
            <ul className="divide-y divide-line">
              {recipe.ingredients.map((item, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-matcha-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {recipe.steps.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.recipes.steps}</h2>
            <ol className="space-y-4">
              {recipe.steps.map((step, i) => (
                <li key={i} className="card flex gap-4 p-4 sm:p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest-700 font-serif text-lg font-semibold text-cream shadow-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss-600">{t.recipes.step(i + 1)}</p>
                    <p className="mt-1 leading-relaxed">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {recipe.notes && (
        <section className="rounded-2xl border border-matcha-300/60 bg-gradient-to-br from-mint-100 to-sage-100 p-5 shadow-soft sm:p-6">
          <h2 className="mb-2 font-serif text-xl font-semibold text-forest-900">{t.recipes.notes}</h2>
          <p className="whitespace-pre-line leading-relaxed">{recipe.notes}</p>
        </section>
      )}

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-sage-200/60 px-3 py-1 text-sm text-forest-800">#{tag}</span>
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold text-forest-900">{t.recipes.sources}</h2>
          <ImageGallery images={sources} variant="scans" />
        </section>
      )}
    </article>
  );
}
