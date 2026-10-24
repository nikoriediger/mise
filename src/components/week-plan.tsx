"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { planRecipe, planToShopping, removePlanned } from "@/app/actions/plan";
import type { ListKind } from "@/app/actions/shopping";
import { Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import type { PlannedMeal } from "@/lib/data";
import { useI18n } from "@/i18n/client";

type PickRecipe = { id: string; title: string; coverUrl: string | null };

const intl = { de: "de-DE", en: "en-GB", it: "it-IT" } as const;
const noopSubscribe = () => () => {};

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekPlan({ weekStart, meals, recipes }: { weekStart: string; meals: PlannedMeal[]; recipes: PickRecipe[] }) {
  const { t, p, locale } = useI18n();
  const today = useSyncExternalStore(noopSubscribe, localToday, () => "");
  const [pickDay, setPickDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl[locale], { timeZone: "UTC", ...opts });
  const q = query.trim().toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">📅 {t.plan.title}</h1>
          <p className="text-sm text-muted">
            {fmt(weekStart, { day: "numeric", month: "short" })} – {fmt(weekEnd, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/plan?week=${addDays(weekStart, -7)}`} aria-label={t.plan.prev} className="btn-secondary min-h-11 min-w-11 px-3">←</Link>
          <Link href="/plan" className="btn-secondary min-h-11 px-3 text-sm">{t.plan.thisWeek}</Link>
          <Link href={`/plan?week=${addDays(weekStart, 7)}`} aria-label={t.plan.next} className="btn-secondary min-h-11 min-w-11 px-3">→</Link>
        </div>
      </div>

      <ol className="space-y-3">
        {days.map((day, i) => {
          const dayMeals = meals.filter((m) => m.planned_on === day);
          const isToday = day === today;
          return (
            <motion.li
              key={day}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.03 }}
              className={`card p-3 sm:p-4 ${isToday ? "ring-2 ring-matcha-400" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium text-forest-900">
                  <span className="capitalize">{fmt(day, { weekday: "long" })}</span>
                  <span className="ml-2 text-sm text-muted">{fmt(day, { day: "numeric", month: "short" })}</span>
                  {isToday && <span className="ml-2 rounded-full bg-matcha-300/60 px-2 py-0.5 text-xs">{t.plan.today}</span>}
                </p>
                <button type="button" aria-label={t.plan.addRecipe} className="flex size-11 items-center justify-center rounded-xl bg-sage-100 text-xl text-forest-800 hover:bg-sage-200" onClick={() => { setQuery(""); setPickDay(day); }}>
                  +
                </button>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {dayMeals.map((m) => (
                    <motion.li key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3">
                      <Link href={`/recipes/${m.recipe.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-sage-50">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-sage-100 to-mint-100">
                          {m.recipe.coverUrl ? (
                            <Image src={m.recipe.coverUrl} alt="" fill unoptimized className="object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center font-serif text-lg text-sage-400">{m.recipe.title.charAt(0)}</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-forest-900">{m.recipe.title}</span>
                          {(m.servings ?? m.recipe.servings) && <span className="block text-xs text-muted">{p(t.recipes.servingsCount, (m.servings ?? m.recipe.servings)!)}</span>}
                        </span>
                      </Link>
                      <button type="button" aria-label={t.plan.remove} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm text-muted hover:bg-red-50 hover:text-red-700" onClick={() => startTransition(() => removePlanned(m.id))}>
                        ✕
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.li>
          );
        })}
      </ol>

      {meals.length === 0 ? (
        <p className="text-center text-sm text-muted">{t.plan.nothing}</p>
      ) : (
        <div className="space-y-2">
          <button type="button" className="btn-primary min-h-12 w-full text-base" onClick={() => setShopOpen(true)}>
            🛒 {t.plan.shoppingForWeek}
          </button>
          {notice && (
            <p className="text-center text-sm text-moss-600">
              {notice} · <Link href="/shopping" className="underline">{t.shopping.open}</Link>
            </p>
          )}
        </div>
      )}

      <Dialog open={pickDay !== null} onClose={() => setPickDay(null)} className="flex max-h-[85vh] flex-col px-5 sm:max-w-lg">
        <h2 className="font-serif text-xl font-semibold text-forest-900">{t.plan.pickRecipe}</h2>
        <p className="mb-3 text-sm text-muted">{pickDay && fmt(pickDay, { weekday: "long", day: "numeric", month: "long" })}</p>
        <input className="input mb-3" type="search" placeholder={t.recipes.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {recipes.filter((r) => !q || r.title.toLowerCase().includes(q)).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={pending}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sage-50"
                onClick={() =>
                  startTransition(async () => {
                    if (pickDay) await planRecipe(r.id, pickDay, null);
                    setPickDay(null);
                  })
                }
              >
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-sage-100 to-mint-100">
                  {r.coverUrl ? <Image src={r.coverUrl} alt="" fill unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center font-serif text-sage-400">{r.title.charAt(0)}</span>}
                </span>
                <span className="truncate font-medium text-forest-900">{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={shopOpen} onClose={() => setShopOpen(false)} className="px-5 sm:max-w-sm">
        <h2 className="mb-4 font-serif text-xl font-semibold text-forest-900">{t.shopping.which}</h2>
        <div className="grid gap-2">
          {(["mine", "family"] as ListKind[]).map((list) => (
            <button
              key={list}
              type="button"
              disabled={pending}
              className="btn-secondary min-h-14 justify-start text-base"
              onClick={() =>
                startTransition(async () => {
                  const { added } = await planToShopping(weekStart, weekEnd, list);
                  setShopOpen(false);
                  setNotice(p(t.shopping.added, added));
                })
              }
            >
              {list === "mine" ? `👤 ${t.shopping.mine}` : `👨‍👩‍👧 ${t.shopping.family}`}
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
