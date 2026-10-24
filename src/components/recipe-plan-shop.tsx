"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { planRecipe } from "@/app/actions/plan";
import { addShoppingLines, type ListKind } from "@/app/actions/shopping";
import { Dialog } from "@/components/dialog";
import { useScale } from "@/components/recipe-scale";
import { useI18n } from "@/i18n/client";

/** Adds the (scaled) ingredients to a shopping list; ingredients you have can be unticked. */
export function AddToShoppingButton({ recipeTitle }: { recipeTitle: string }) {
  const { t, p } = useI18n();
  const { scaled } = useScale();
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  if (scaled.length === 0) return null;

  const add = (list: ListKind) =>
    startTransition(async () => {
      const { added } = await addShoppingLines(scaled.filter((_, i) => !skip.includes(i)), list, recipeTitle);
      setNotice(p(t.shopping.added, added));
    });

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => { setSkip([]); setNotice(""); setOpen(true); }}>
        🛒 {t.shopping.addFromRecipe}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="flex max-h-[88dvh] flex-col px-5 sm:max-w-md">
        <h2 className="font-serif text-xl font-semibold text-forest-900">{t.shopping.dialogTitle}</h2>
        <p className="mb-3 text-sm text-muted">{t.shopping.dialogHint}</p>
        <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {scaled.map((line, i) => {
            const on = !skip.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setSkip((s) => (on ? [...s, i] : s.filter((x) => x !== i)))}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-sage-50"
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-xs ${on ? "border-forest-700 bg-forest-700 text-cream" : "border-sage-300"}`}>{on && "✓"}</span>
                  <span className={on ? "text-forest-900" : "text-muted line-through"}>{line}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {notice ? (
          <div className="mt-4 space-y-2 text-center">
            <p className="text-sm text-moss-600">{notice}</p>
            <Link href="/shopping" className="btn-primary min-h-12 w-full">{t.shopping.open}</Link>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="label">{t.shopping.which}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-primary min-h-12" disabled={pending} onClick={() => add("mine")}>👤 {t.shopping.mine}</button>
              <button type="button" className="btn-secondary min-h-12" disabled={pending} onClick={() => add("family")}>👨‍👩‍👧 {t.shopping.family}</button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

const intl = { de: "de-DE", en: "en-GB", it: "it-IT" } as const;

/** Puts the recipe on a day of the meal plan (with the currently selected servings). */
export function PlanRecipeButton({ recipeId }: { recipeId: string }) {
  const { t, f, locale } = useI18n();
  const { recipe, amount } = useScale();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const label = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString(intl[locale], opts);

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => { setNotice(""); setOpen(true); }}>
        📅 {t.plan.planButton}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="px-5 sm:max-w-md">
        <h2 className="mb-3 font-serif text-xl font-semibold text-forest-900">{t.plan.pickDay}</h2>
        {notice ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-moss-600">{notice}</p>
            <Link href="/plan" className="btn-primary min-h-12 w-full">{t.plan.open}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {days.map((day, i) => (
              <button
                key={day}
                type="button"
                disabled={pending}
                className="btn-secondary min-h-14 flex-col gap-0 text-sm"
                onClick={() =>
                  startTransition(async () => {
                    const { ok } = await planRecipe(recipeId, day, recipe.servings ? amount : null);
                    if (ok) setNotice(f(t.plan.planned, { date: label(day, { weekday: "long", day: "numeric", month: "long" }) }));
                  })
                }
              >
                <span className="font-semibold capitalize">{i === 0 ? t.plan.today : label(day, { weekday: "short" })}</span>
                <span className="text-xs text-muted">{label(day, { day: "numeric", month: "short" })}</span>
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}
