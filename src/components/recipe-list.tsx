"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { removeFromCookbook } from "@/app/actions/recipes";
import { spring } from "@/components/motion";
import type { Cookbook, RecipeListItem } from "@/lib/types";
import { t } from "@/i18n";

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

type ListCookbook = Pick<Cookbook, "id" | "name" | "emoji">;

type Props = {
  recipes: RecipeListItem[];
  cookbooks: ListCookbook[];
  /** Shows the title, count and cookbook filter (off when embedded in a cookbook page). */
  standalone?: boolean;
  /** Collection id: shows a remove button on each card. */
  removableFrom?: string;
};

export function RecipeList({ recipes, cookbooks, standalone = true, removableFrom }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cookbookId, setCookbookId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const categories = useMemo(
    () => [...new Set(recipes.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort(),
    [recipes],
  );
  const showCookbooks = standalone && cookbooks.length > 1;

  const q = query.trim().toLowerCase();
  const filtered = recipes.filter(
    (r) =>
      !removed.includes(r.id) &&
      (!category || r.category === category) &&
      (!cookbookId || r.cookbook_ids.includes(cookbookId)) &&
      (!q || r.title.toLowerCase().includes(q) || r.tags.some((tag) => tag.toLowerCase().includes(q))),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {standalone ? (
          <div>
            <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{t.recipes.title}</h1>
            <p className="mt-1 text-sm text-muted">{t.recipes.count(recipes.length)}</p>
          </div>
        ) : (
          <span />
        )}
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

      {showCookbooks && (
        <FilterChips
          layoutId="cookbook-pill"
          value={cookbookId}
          onChange={setCookbookId}
          options={[
            { value: null, label: t.recipes.allCookbooks },
            ...cookbooks.map((b) => ({ value: b.id, label: `${b.emoji} ${b.name}` })),
          ]}
        />
      )}
      {categories.length > 0 && (
        <FilterChips
          layoutId="category-pill"
          value={category}
          onChange={setCategory}
          options={[{ value: null, label: t.recipes.all }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
      )}

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">{t.recipes.noResults}</p>
      ) : (
        <motion.ul
          key={`${category}-${cookbookId}-${q}`}
          variants={grid}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <AnimatePresence>
            {filtered.map((recipe) => (
              <motion.li key={recipe.id} variants={card} layout exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}>
                <RecipeCard
                  recipe={recipe}
                  removableFrom={removableFrom}
                  onRemoved={() => setRemoved((ids) => [...ids, recipe.id])}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function FilterChips<T extends string | null>(props: {
  layoutId: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map((option) => {
        const active = props.value === option.value;
        return (
          <motion.button
            key={option.value ?? "__all"}
            onClick={() => props.onChange(option.value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              active ? "text-cream" : "bg-cream/70 text-forest-800 shadow-soft hover:bg-cream"
            }`}
          >
            {active && (
              <motion.span layoutId={props.layoutId} className="absolute inset-0 rounded-full bg-forest-700 shadow-soft" transition={spring} />
            )}
            <span className="relative">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function RecipeCard({ recipe, removableFrom, onRemoved }: { recipe: RecipeListItem; removableFrom?: string; onRemoved: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <motion.div
      className="relative h-full rounded-2xl"
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
        <div className="space-y-1.5 p-3.5">
          <h2 className="line-clamp-2 font-medium leading-snug text-forest-900">{recipe.title}</h2>
          {!recipe.is_mine && recipe.owner_name && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-sage-100/90 px-2.5 py-0.5 text-xs font-medium text-forest-800">
              👤 <span className="truncate">{recipe.owner_name}</span> <span title={t.recipes.readOnly}>🔒</span>
            </span>
          )}
          {totalTime(recipe) && <p className="text-xs text-muted">⏱ {totalTime(recipe)}</p>}
        </div>
      </Link>
      {removableFrom && (
        <motion.button
          type="button"
          title={t.recipes.removeFromCookbook}
          aria-label={t.recipes.removeFromCookbook}
          disabled={pending}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          onClick={() =>
            startTransition(async () => {
              const result = await removeFromCookbook(removableFrom, recipe.id);
              if (!result?.error) onRemoved();
            })
          }
          className="glass absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-sm text-forest-900 shadow-soft hover:bg-red-50 hover:text-red-700"
        >
          ✕
        </motion.button>
      )}
    </motion.div>
  );
}

function totalTime(r: RecipeListItem) {
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return total ? `${total} ${t.common.minutes}` : "";
}
