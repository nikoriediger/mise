import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CookModeButton } from "@/components/cook-mode";
import { CookbookBadge } from "@/components/cookbook-badge";
import { CookbookMembershipButton } from "@/components/cookbook-membership-button";
import { CopyRecipeButton } from "@/components/copy-recipe-button";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { FamilyNotes } from "@/components/family-notes";
import { ImageGallery } from "@/components/image-gallery";
import { Loading } from "@/components/loading";
import { PrintButton, ShareButton } from "@/components/recipe-actions";
import { IngredientsCard, ScaleProvider } from "@/components/recipe-scale";
import { getMyCookbooks, getRecipe, getRecipeNotes } from "@/lib/data";
import { appName, t } from "@/i18n";

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
  const notes = await getRecipeNotes(recipe);

  const ownBooks = myCookbooks.filter((b) => b.family_id === recipe.family_id);
  const myCollectionsWithRecipe = recipe.cookbooks.filter((b) => b.is_mine && !b.is_default).map((b) => b.id);
  const collectionCount = recipe.cookbooks.filter((b) => !b.is_default).length;

  const gallery = recipe.images
    .filter((img) => img.role === "gallery")
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
  const sources = recipe.images.filter((img) => img.role === "source");
  const times = [
    recipe.prep_minutes && { label: t.recipes.prepTime, value: `${recipe.prep_minutes} ${t.common.minutes}` },
    recipe.cook_minutes && { label: t.recipes.cookTime, value: `${recipe.cook_minutes} ${t.common.minutes}` },
  ].filter((f): f is { label: string; value: string } => Boolean(f));
  const basics = { title: recipe.title, ingredients: recipe.ingredients, steps: recipe.steps, servings: recipe.servings };

  return (
    <ScaleProvider recipe={basics}>
      <article className="space-y-10 print:space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="mr-auto min-w-0">
            {recipe.category && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-moss-600">{recipe.category}</p>
            )}
            <h1 className="font-serif text-4xl font-semibold leading-tight text-forest-900 sm:text-5xl print:text-3xl">{recipe.title}</h1>
            {!recipe.canEdit && (
              <p className="mt-2 text-sm text-muted">
                👤 {t.recipes.byOwner(recipe.owner_name || "…")} <span className="print:hidden">· 🔒 {t.recipes.readOnly}</span>
              </p>
            )}
            {recipe.cookbooks.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-muted print:hidden">
                <span className="mr-1">{t.recipes.inCookbooks}:</span>
                {recipe.cookbooks.map((b) => (
                  <CookbookBadge key={b.id} cookbook={b} link />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <CookbookMembershipButton recipeId={recipe.id} isMine={recipe.canEdit} cookbooks={ownBooks} selected={myCollectionsWithRecipe} />
            {recipe.canEdit ? (
              <>
                <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">{t.common.edit}</Link>
                <DeleteRecipeButton id={recipe.id} collectionCount={collectionCount} />
              </>
            ) : (
              <CopyRecipeButton recipeId={recipe.id} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(recipe.ingredients.length > 0 || recipe.steps.length > 0) && <CookModeButton recipeId={recipe.id} />}
          <PrintButton />
          <ShareButton coverUrl={gallery[0]?.url ?? null} facts={times.map((f) => f.value)} />
          {times.length > 0 && (
            <dl className="ml-auto flex flex-wrap gap-3 print:ml-0">
              {times.map((f) => (
                <div key={f.label} className="card px-4 py-2 print:border-0 print:p-0 print:shadow-none">
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd className="font-semibold text-forest-800">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {gallery.length > 0 && (
          <>
            <div className="print:hidden">
              <ImageGallery images={gallery} />
            </div>
            <div className="relative hidden aspect-[16/7] w-full overflow-hidden rounded-xl print:block">
              <Image src={gallery[0].url} alt="" fill unoptimized className="object-cover" />
            </div>
          </>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] print:grid-cols-[2fr_3fr] print:gap-6">
          {recipe.ingredients.length > 0 && <IngredientsCard />}
          {recipe.steps.length > 0 && (
            <section>
              <h2 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.recipes.steps}</h2>
              <ol className="space-y-4 print:space-y-2">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="card flex gap-4 p-4 sm:p-5 print:break-inside-avoid print:border-0 print:p-0 print:shadow-none">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest-700 font-serif text-lg font-semibold text-cream shadow-soft print:size-7 print:text-sm">
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss-600 print:hidden">{t.recipes.step(i + 1)}</p>
                      <p className="mt-1 leading-relaxed print:mt-0">{step}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {recipe.notes && (
          <section className="rounded-2xl border border-matcha-300/60 bg-gradient-to-br from-mint-100 to-sage-100 p-5 shadow-soft sm:p-6 print:break-inside-avoid print:border print:bg-none print:p-4 print:shadow-none">
            <h2 className="mb-2 font-serif text-xl font-semibold text-forest-900">{t.recipes.notes}</h2>
            <p className="whitespace-pre-line leading-relaxed">{recipe.notes}</p>
          </section>
        )}

        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 print:hidden">
            {recipe.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-sage-200/60 px-3 py-1 text-sm text-forest-800">#{tag}</span>
            ))}
          </div>
        )}

        <FamilyNotes recipeId={recipe.id} notes={notes} />

        {sources.length > 0 && (
          <section className="print:hidden">
            <h2 className="mb-3 font-serif text-2xl font-semibold text-forest-900">{t.recipes.sources}</h2>
            <ImageGallery images={sources} variant="scans" />
          </section>
        )}

        <p className="hidden text-xs text-muted print:block">{appName}</p>
      </article>
    </ScaleProvider>
  );
}
