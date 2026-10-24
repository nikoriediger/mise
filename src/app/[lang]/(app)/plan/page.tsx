import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { WeekPlan } from "@/components/week-plan";
import { listMealPlan, listRecipes } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.plan.title };
}

export default function PlanPage({ searchParams }: PageProps<"/[lang]/plan">) {
  return (
    <Suspense fallback={<Loading />}>
      <Plan searchParams={searchParams} />
    </Suspense>
  );
}

/** Monday of the week containing `iso` (or today). */
function mondayOf(iso?: string) {
  const d = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

async function Plan({ searchParams }: Pick<PageProps<"/[lang]/plan">, "searchParams">) {
  const { week } = await searchParams;
  const weekStart = mondayOf(typeof week === "string" ? week : undefined);
  const end = new Date(`${weekStart}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const [meals, recipes] = await Promise.all([listMealPlan(weekStart, end.toISOString().slice(0, 10)), listRecipes()]);

  return (
    <div className="mx-auto max-w-2xl">
      <WeekPlan
        key={weekStart}
        weekStart={weekStart}
        meals={meals}
        recipes={recipes.map((r) => ({ id: r.id, title: r.title, coverUrl: r.coverUrl }))}
      />
    </div>
  );
}
