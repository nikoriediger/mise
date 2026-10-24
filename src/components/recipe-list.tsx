"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { spring } from "@/components/motion";
import type { RecipeListItem } from "@/lib/types";
import { t } from "@/i18n";

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export function RecipeList({ recipes }: { recipes: RecipeListItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(recipes.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort(),
    [recipes],
  );

  const q = query.trim().toLowerCase();
  const filtered = recipes.filter(
    (r) =>
      (!category || r.category === category) &&
      (!q || r.title.toLowerCase().includes(q) || r.tags.some((tag) => tag.toLowerCase().includes(q))),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{t.recipes.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.recipes.count(recipes.length)}</p>
        </div>
        <div className="relative sm:w-72">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">⌕</span>
          <input
            className="input pl-9"
            type="search"
            placeholder={t.recipes.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[null, ...categories].map((c) => {
            const active = category === c;
            return (
              <motion.button
                key={c ?? "__all"}
                onClick={() => setCategory(c)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={spring}
                className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "text-cream" : "bg-cream/70 text-forest-800 shadow-soft hover:bg-cream"
                }`}
              >
                {active && (
                  <motion.span layoutId="category-pill" className="absolute inset-0 rounded-full bg-forest-700 shadow-soft" transition={spring} />
                )}
                <span className="relative">{c ?? t.recipes.all}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">{t.recipes.noResults}</p>
      ) : (
        <motion.ul
          key={`${category}-${q}`}
          variants={grid}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <AnimatePresence>
            {filtered.map((recipe) => (
              <motion.li key={recipe.id} variants={card} layout>
                <RecipeCard recipe={recipe} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <motion.div
      className="h-full rounded-2xl"
      whileHover={{ y: -6, boxShadow: "var(--shadow-lifted)" }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <Link
        href={`/recipes/${recipe.id}`}
        className="group block h-full overflow-hidden rounded-2xl border border-white/70 bg-cream"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-sage-100 to-mint-100">
          {recipe.coverUrl ? (
            <Image
              src={recipe.coverUrl}
              alt=""
              fill
              unoptimized
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-serif text-5xl text-sage-400 transition-transform duration-500 group-hover:scale-110">
              {recipe.title.charAt(0).toUpperCase()}
            </div>
          )}
          {recipe.category && (
            <span className="glass absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium text-forest-800">
              {recipe.category}
            </span>
          )}
        </div>
        <div className="p-3.5">
          <h2 className="line-clamp-2 font-medium leading-snug text-forest-900">{recipe.title}</h2>
          {totalTime(recipe) && <p className="mt-1 text-xs text-muted">⏱ {totalTime(recipe)}</p>}
        </div>
      </Link>
    </motion.div>
  );
}

function totalTime(r: RecipeListItem) {
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return total ? `${total} ${t.common.minutes}` : "";
}
