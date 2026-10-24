/* eslint-disable @next/next/no-img-element -- printed book uses plain images */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { PrintNowButton } from "@/components/recipe-actions";
import { getCookbook, getCookbookRecipesFull } from "@/lib/data";
import { categoryEmoji, dietEmoji } from "@/lib/taxonomy";
import { getI18n } from "@/i18n/server";

export default function CookbookPrintPage({ params }: PageProps<"/[lang]/cookbooks/[id]/print">) {
  return (
    <Suspense fallback={<Loading />}>
      <Book params={params} />
    </Suspense>
  );
}

async function Book({ params }: Pick<PageProps<"/[lang]/cookbooks/[id]/print">, "params">) {
  const { t, f, p, date } = await getI18n();
  const { id } = await params;
  const cookbook = await getCookbook(id);
  if (!cookbook) notFound();
  const recipes = await getCookbookRecipesFull(cookbook.id);

  return (
    <div className="book mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/cookbooks/${cookbook.id}`} className="btn-secondary min-h-11">← {t.book.back}</Link>
        <PrintNowButton label={t.book.printNow} />
        <p className="w-full text-sm text-muted">{t.book.printHint}</p>
      </div>

      {/* Title page */}
      <section className="card flex min-h-[70vh] flex-col items-center justify-center gap-4 p-10 text-center print:min-h-[250mm] print:border-0 print:shadow-none">
        <span className="text-7xl">{cookbook.emoji}</span>
        <h1 className="font-serif text-5xl font-semibold text-forest-900">{cookbook.name}</h1>
        {cookbook.owner_name && <p className="font-serif text-xl italic text-moss-600">{f(t.book.by, { name: cookbook.owner_name })}</p>}
        <p className="text-sm text-muted">{p(t.recipes.count, recipes.length)} · {f(t.book.printedOn, { date: date(new Date()) })}</p>
      </section>

      {/* Contents */}
      <section className="card mt-6 p-8 print:mt-0 print:break-before-page print:border-0 print:shadow-none">
        <h2 className="mb-4 font-serif text-3xl font-semibold text-forest-900">{t.book.contents}</h2>
        <ol className="space-y-1.5">
          {recipes.map((r, i) => (
            <li key={r.id} className="flex items-baseline gap-3">
              <span className="w-8 shrink-0 text-right font-serif text-moss-600">{i + 1}</span>
              <a href={`#recipe-${r.id}`} className="flex-1 border-b border-dotted border-line text-forest-900">{r.title}</a>
            </li>
          ))}
        </ol>
      </section>

      {/* Recipes, one per page */}
      {recipes.map((r, i) => (
        <article key={r.id} id={`recipe-${r.id}`} className="card mt-6 space-y-5 p-8 print:mt-0 print:break-before-page print:border-0 print:p-0 print:shadow-none">
          <header>
            <p className="font-serif text-sm text-moss-600">{[String(i + 1), ...r.categories.map((c) => `${categoryEmoji(c)} ${t.categories[c]}`), ...r.diet.map((d) => `${dietEmoji(d)} ${t.diet[d]}`)].join(" · ")}</p>
            <h2 className="font-serif text-4xl font-semibold text-forest-900">{r.title}</h2>
            {r.origin && <p className="mt-1 font-serif italic text-moss-600">📜 {r.origin}</p>}
            <p className="mt-2 text-sm text-muted">
              {[
                r.servings && p(t.recipes.servingsCount, r.servings),
                r.prep_minutes && `${t.recipes.prepTime}: ${r.prep_minutes} ${t.common.minutes}`,
                r.cook_minutes && `${t.recipes.cookTime}: ${r.cook_minutes} ${t.common.minutes}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>
          {r.coverUrl && <img src={r.coverUrl} alt="" className="aspect-[16/7] w-full rounded-xl object-cover" />}
          <div className="grid gap-6 sm:grid-cols-[2fr_3fr] print:grid-cols-[2fr_3fr]">
            {r.ingredients.length > 0 && (
              <section>
                <h3 className="mb-2 font-serif text-xl font-semibold text-forest-900">{t.recipes.ingredients}</h3>
                <ul className="space-y-1">
                  {r.ingredients.map((line, j) => (
                    <li key={j} className="flex gap-2"><span className="text-matcha-500">•</span>{line}</li>
                  ))}
                </ul>
              </section>
            )}
            {r.steps.length > 0 && (
              <section>
                <h3 className="mb-2 font-serif text-xl font-semibold text-forest-900">{t.recipes.steps}</h3>
                <ol className="space-y-2">
                  {r.steps.map((step, j) => (
                    <li key={j} className="flex gap-3 print:break-inside-avoid">
                      <span className="font-serif font-semibold text-moss-600">{j + 1}.</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
          {r.notes && (
            <section className="rounded-xl bg-mint-100/60 p-4 print:break-inside-avoid print:border print:bg-none">
              <h3 className="mb-1 font-serif text-lg font-semibold text-forest-900">{t.recipes.notes}</h3>
              <p className="whitespace-pre-line">{r.notes}</p>
            </section>
          )}
          {r.story && (
            <section className="print:break-inside-avoid">
              <h3 className="mb-1 font-serif text-lg font-semibold text-forest-900">{t.story.title}</h3>
              <p className="whitespace-pre-line font-serif italic leading-relaxed">{r.story}</p>
            </section>
          )}
        </article>
      ))}
    </div>
  );
}
