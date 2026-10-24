import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionsSheet } from "@/components/actions-sheet";
import { CookLog } from "@/components/cook-log";
import { CookModeButton } from "@/components/cook-mode";
import { FavoriteButton } from "@/components/favorite-button";
import { SaveForOffline } from "@/components/pwa";
import { PersonLink } from "@/components/person-link";
import { CookbookBadge } from "@/components/cookbook-badge";
import { CookbookMembershipButton } from "@/components/cookbook-membership-button";
import { CopyRecipeButton } from "@/components/copy-recipe-button";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { FamilyNotes } from "@/components/family-notes";
import { ImageGallery } from "@/components/image-gallery";
import { Loading } from "@/components/loading";
import { PrintButton, ShareButton } from "@/components/recipe-actions";
import { AddToShoppingButton, PlanRecipeButton } from "@/components/recipe-plan-shop";
import { IngredientsCard, ScaleProvider } from "@/components/recipe-scale";
import { recipeViewTools } from "@/features/registry";
import { categoryEmoji, dietEmoji } from "@/lib/taxonomy";
import { getCookLog, getMyCookbooks, getRecipe, getRecipeNotes, getTranslation } from "@/lib/data";
import { appName } from "@/i18n/config";
import { localeFlags } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export default function RecipePage({ params, searchParams }: PageProps<"/[lang]/recipes/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <RecipeDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RecipeDetail({ params, searchParams }: Pick<PageProps<"/[lang]/recipes/[id]">, "params" | "searchParams">) {
  const { t, f, locale } = await getI18n();
  const [{ id }, { original }] = await Promise.all([params, searchParams]);
  const [stored, myCookbooks] = await Promise.all([getRecipe(id), getMyCookbooks()]);
  if (!stored) notFound();
  // Show a stored translation into the UI language, unless the original was requested
  const showingOriginal = original === "1";
  const translation = await getTranslation(stored, locale);
  const recipe = translation && !showingOriginal ? { ...stored, ...translation } : stored;
  const [notes, cookLog] = await Promise.all([getRecipeNotes(recipe), getCookLog(recipe)]);
  const memories = recipe.images.filter((img) => img.role === "memory");

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
  const secondaryActions = (
    <>
      <AddToShoppingButton recipeTitle={recipe.title} />
      <PlanRecipeButton recipeId={recipe.id} />
      <CookbookMembershipButton recipeId={recipe.id} isMine={recipe.canEdit} cookbooks={ownBooks} selected={myCollectionsWithRecipe} />
      {recipe.canEdit ? (
        <>
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">✎ {t.common.edit}</Link>
          <DeleteRecipeButton id={recipe.id} collectionCount={collectionCount} />
        </>
      ) : (
        <CopyRecipeButton recipeId={recipe.id} />
      )}
    </>
  );

  return (
    <ScaleProvider recipe={basics}>
      <article className="space-y-10 print:space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="mr-auto min-w-0">
            {recipe.categories.length > 0 && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-moss-600">
                {recipe.categories.map((c) => `${categoryEmoji(c)} ${t.categories[c]}`).join(" · ")}
              </p>
            )}
            <h1 className="break-words font-serif text-3xl font-semibold leading-tight text-forest-900 sm:text-5xl print:text-3xl">{recipe.title}</h1>
            {recipe.origin && <p className="mt-2 font-serif text-lg italic text-moss-600">📜 {recipe.origin}</p>}
            {recipe.diet.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {recipe.diet.map((d) => (
                  <li key={d} className="rounded-full bg-mint-100 px-3 py-1 text-sm font-medium text-forest-800 ring-1 ring-matcha-300/70">
                    {dietEmoji(d)} {t.diet[d]}
                  </li>
                ))}
              </ul>
            )}
            {recipe.language && recipe.language !== locale && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-forest-800 print:hidden">
                {localeFlags[recipe.language]} {t.lang[recipe.language]}
              </p>
            )}
            {translation && stored.language && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-mint-100/80 px-3 py-2 text-sm text-forest-800 print:hidden">
                <span>🌍 {f(t.translation.translatedFrom, { lang: t.translation.from[stored.language] })}</span>
                <Link href={showingOriginal ? `/recipes/${stored.id}` : `/recipes/${stored.id}?original=1`} className="font-medium underline underline-offset-2">
                  {showingOriginal ? t.translation.showTranslation : t.translation.showOriginal}
                </Link>
              </p>
            )}
            {recipeViewTools.map((Tool, i) => (
              <Tool
                key={i}
                recipeId={stored.id}
                recipeLanguage={stored.language}
                uiLocale={locale}
                hasTranslation={Boolean(translation)}
                showingOriginal={showingOriginal}
              />
            ))}
            {!recipe.canEdit && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                <PersonLink
                  userId={recipe.owner_id}
                  name={recipe.owner_name}
                  avatarUrl={recipe.owner_avatar}
                  label={f(t.recipes.byOwner, { name: recipe.owner_name || "…" })}
                />
                <span className="print:hidden">· 🔒 {t.recipes.readOnly}</span>
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
          <div className="hidden flex-wrap gap-2 md:flex print:hidden">{secondaryActions}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(recipe.ingredients.length > 0 || recipe.steps.length > 0) && <CookModeButton recipeId={recipe.id} />}
          <div className="hidden md:block">
            <PrintButton />
          </div>
          <ShareButton coverUrl={gallery[0]?.url ?? null} facts={times.map((x) => x.value)} />
          <FavoriteButton recipeId={recipe.id} initial={recipe.is_favorite} />
          <ActionsSheet title={recipe.title}>
            {secondaryActions}
            <PrintButton />
          </ActionsSheet>
          {times.length > 0 && (
            <dl className="flex w-full flex-wrap gap-3 md:ml-auto md:w-auto print:ml-0">
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
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss-600 print:hidden">{f(t.recipes.step, { n: i + 1 })}</p>
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

        {(recipe.story || memories.length > 0) && (
          <section className="space-y-4 rounded-3xl border border-matcha-300/60 bg-gradient-to-br from-cream via-mint-100/40 to-matcha-300/20 p-5 shadow-soft sm:p-7 print:break-inside-avoid print:border print:bg-none print:shadow-none">
            <h2 className="font-serif text-2xl font-semibold text-forest-900">📜 {t.story.title}</h2>
            {recipe.story && <p className="whitespace-pre-line font-serif text-lg leading-relaxed text-forest-900">{recipe.story}</p>}
            {memories.length > 0 && (
              <div className="print:hidden">
                <ImageGallery images={memories} variant="scans" />
              </div>
            )}
          </section>
        )}

        <CookLog recipeId={recipe.id} familyId={recipe.family_id} entries={cookLog} />

        <FamilyNotes recipeId={recipe.id} notes={notes} />
        <SaveForOffline path={`/recipes/${recipe.id}`} />

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
