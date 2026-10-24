import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RecipeForm } from "@/components/recipe-form";
import { getCookbooks, listRecipeTitles } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.form.newTitle };

export default function NewRecipePage({ searchParams }: PageProps<"/recipes/new">) {
  return (
    <Suspense fallback={<Loading />}>
      <NewRecipe searchParams={searchParams} />
    </Suspense>
  );
}

async function NewRecipe({ searchParams }: Pick<PageProps<"/recipes/new">, "searchParams">) {
  const [{ cookbook: requested }, cookbooks, titles] = await Promise.all([searchParams, getCookbooks(), listRecipeTitles()]);
  const mine = cookbooks.filter((b) => b.is_mine);
  const initial = mine.find((b) => b.id === requested) ?? mine[0];
  if (!initial) throw new Error("No own cookbook");

  const byId = new Map(cookbooks.map((b) => [b.id, b]));
  const existing = titles.map((r) => {
    const book = byId.get(r.cookbook_id);
    return { id: r.id, title: r.title, cookbook: book ? `${book.emoji} ${book.name}` : "" };
  });

  // A fresh id per visit: after saving, the next visit starts with an empty form.
  const draftId = crypto.randomUUID();
  return <RecipeForm key={draftId} draftId={draftId} cookbooks={mine} initialCookbookId={initial.id} existing={existing} />;
}
