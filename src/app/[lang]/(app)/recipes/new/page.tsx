import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RecipeForm } from "@/components/recipe-form";
import { getMyCookbooks, getPrimaryFamily, listRecipeTitles } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.form.newTitle };
}

export default function NewRecipePage({ searchParams }: PageProps<"/[lang]/recipes/new">) {
  return (
    <Suspense fallback={<Loading />}>
      <NewRecipe searchParams={searchParams} />
    </Suspense>
  );
}

async function NewRecipe({ searchParams }: Pick<PageProps<"/[lang]/recipes/new">, "searchParams">) {
  const [{ cookbook: requested }, family, mine, existing] = await Promise.all([
    searchParams,
    getPrimaryFamily(),
    getMyCookbooks(),
    listRecipeTitles(),
  ]);
  const cookbooks = mine.filter((b) => b.family_id === family.family_id);
  // Opened from a collection: pre-select it
  const preselected = cookbooks.filter((b) => !b.is_default && b.id === requested).map((b) => b.id);

  // A fresh id per visit: after saving, the next visit starts with an empty form.
  const draftId = crypto.randomUUID();
  return (
    <RecipeForm
      key={draftId}
      draftId={draftId}
      familyId={family.family_id}
      cookbooks={cookbooks}
      initialCollectionIds={preselected}
      existing={existing}
    />
  );
}
