import type { Metadata } from "next";
import { Suspense } from "react";
import { CookbookGrid, CreateCookbookButton } from "@/components/cookbook-controls";
import { Loading } from "@/components/loading";
import { getCookbooks } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.cookbooks.title };

export default function CookbooksPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Cookbooks />
    </Suspense>
  );
}

async function Cookbooks() {
  const cookbooks = await getCookbooks();
  const mine = cookbooks.filter((b) => b.is_mine);
  const others = cookbooks.filter((b) => !b.is_mine);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{t.cookbooks.title}</h1>
        <CreateCookbookButton />
      </div>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold text-forest-900">{t.cookbooks.mine}</h2>
        <CookbookGrid cookbooks={mine} />
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold text-forest-900">{t.cookbooks.family}</h2>
        {others.length ? <CookbookGrid cookbooks={others} showOwner /> : <p className="text-sm text-muted">{t.cookbooks.familyEmpty}</p>}
      </section>
    </div>
  );
}
