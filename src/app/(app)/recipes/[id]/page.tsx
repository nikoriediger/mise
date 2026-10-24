import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { Loading } from "@/components/loading";
import { getRecipe } from "@/lib/data";
import type { RecipeImage } from "@/lib/types";
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
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  const gallery = recipe.images
    .filter((img) => img.role === "gallery")
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
  const sources = recipe.images.filter((img) => img.role === "source");
  const meta = [
    recipe.servings && t.recipes.servingsCount(recipe.servings),
    recipe.prep_minutes && `${t.recipes.prepTime}: ${recipe.prep_minutes} ${t.common.minutes}`,
    recipe.cook_minutes && `${t.recipes.cookTime}: ${recipe.cook_minutes} ${t.common.minutes}`,
  ].filter(Boolean);

  return (
    <article className="space-y-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          {recipe.category && (
            <p className="text-sm font-medium uppercase tracking-wide text-accent">{recipe.category}</p>
          )}
          <h1 className="font-serif text-3xl font-semibold sm:text-4xl">{recipe.title}</h1>
          {meta.length > 0 && <p className="mt-2 text-sm text-muted">{meta.join(" · ")}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">{t.common.edit}</Link>
          <DeleteRecipeButton id={recipe.id} />
        </div>
      </div>

      {gallery.length > 0 && <ImageStrip images={gallery} large />}

      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        {recipe.ingredients.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold">{t.recipes.ingredients}</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((item, i) => (
                <li key={i} className="border-b border-line pb-2">{item}</li>
              ))}
            </ul>
          </section>
        )}
        {recipe.steps.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold">{t.recipes.steps}</h2>
            <ol className="space-y-4">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {recipe.notes && (
        <section className="card p-4">
          <h2 className="mb-2 font-serif text-lg font-semibold">{t.recipes.notes}</h2>
          <p className="whitespace-pre-line leading-relaxed">{recipe.notes}</p>
        </section>
      )}

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-line px-3 py-1 text-sm">#{tag}</span>
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-xl font-semibold">{t.recipes.sources}</h2>
          <ImageStrip images={sources} />
        </section>
      )}
    </article>
  );
}

function ImageStrip({ images, large }: { images: RecipeImage[]; large?: boolean }) {
  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
      {images.map((img) => (
        <a
          key={img.id}
          href={img.url}
          target="_blank"
          rel="noreferrer"
          className={`relative shrink-0 snap-start overflow-hidden rounded-xl bg-line ${
            large ? "aspect-[4/3] w-80 sm:w-96" : "aspect-[3/4] w-40"
          }`}
        >
          <Image src={img.url} alt="" fill unoptimized className="object-cover" />
        </a>
      ))}
    </div>
  );
}
