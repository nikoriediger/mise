import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { CookbookGrid } from "@/components/cookbook-controls";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { RecipeList } from "@/components/recipe-list";
import { getCookbooksWithCovers, getPersonProfile } from "@/lib/data";
import { appName } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export default function PersonPage({ params }: PageProps<"/[lang]/people/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Person params={params} />
    </Suspense>
  );
}

async function Person({ params }: Pick<PageProps<"/[lang]/people/[id]">, "params">) {
  const { t, f, p, date } = await getI18n();
  const { id } = await params;
  const person = await getPersonProfile(id);
  if (!person) return <EmptyState text={t.people.notFound} href="/" cta={t.notFound.back} />;

  const covers = new Map((await getCookbooksWithCovers()).map((b) => [b.id, b.coverUrl]));
  const cookbooks = person.cookbooks.map((b) => ({ ...b, coverUrl: covers.get(b.id) ?? null }));
  const name = person.display_name || "…";

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-mint-100 via-sage-100 to-matcha-300/40 px-5 pb-6 pt-10 text-center shadow-soft sm:px-8">
        <div className="flex flex-col items-center gap-3">
          <Avatar url={person.avatar_url} name={name} size="lg" className="shadow-lifted ring-4 ring-cream" />
          <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{name}</h1>
          {person.bio && <p className="max-w-md font-serif text-lg italic text-forest-800">„{person.bio}“</p>}
          <p className="text-sm text-muted">
            {person.role === "owner" ? t.family.owner : t.family.member}
            {person.joined_at && ` · ${f(t.people.since, { date: date(person.joined_at) })}`}
          </p>
          {person.is_me && (
            <Link href="/profile" className="btn-secondary mt-1 min-h-11">✎ {t.people.edit}</Link>
          )}
        </div>

        <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
          <div className="card px-4 py-3">
            <dt className="sr-only">{t.recipes.title}</dt>
            <dd className="font-serif text-3xl font-semibold text-forest-900">{person.recipe_count}</dd>
            <dd className="text-sm text-muted">{t.recipes.title}</dd>
          </div>
          <div className="card px-4 py-3">
            <dt className="sr-only">{t.cookLog.title}</dt>
            <dd className="font-serif text-3xl font-semibold text-forest-900">🍳 {person.cook_count}</dd>
            <dd className="text-sm text-muted">
              {person.cook_count ? p(t.people.cooked, person.cook_count, { app: appName }) : f(t.people.cookedNone, { app: appName })}
            </dd>
          </div>
        </dl>
      </section>

      {cookbooks.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-forest-900">
            📚 {person.is_me ? t.people.myCookbooks : f(t.people.cookbooks, { name })}
          </h2>
          <CookbookGrid cookbooks={cookbooks} />
        </section>
      )}

      {person.recent_cooking.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl font-semibold text-forest-900">🍳 {t.people.recentCooking}</h2>
          <ul className="card divide-y divide-line">
            {person.recent_cooking.map((e) => (
              <li key={e.id}>
                <Link href={`/recipes/${e.recipe_id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-sage-50">
                  <span className="flex-1 truncate font-medium text-forest-900">{e.recipe_title}</span>
                  {e.rating && <span className="text-sm text-amber-500">{"★".repeat(e.rating)}</span>}
                  <span className="text-sm text-muted">{date(e.cooked_on)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">
          🍽 {person.is_me ? t.people.myRecipes : f(t.people.recipes, { name })}
        </h2>
        {person.recipes.length ? (
          <RecipeList recipes={person.recipes} cookbooks={[]} standalone={false} />
        ) : (
          <p className="text-sm text-muted">{t.people.noRecipes}</p>
        )}
      </section>
    </div>
  );
}
