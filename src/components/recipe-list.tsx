"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { removeFromCookbook } from "@/app/actions/recipes";
import { spring } from "@/components/motion";
import { allowedMissing, matchIngredients } from "@/lib/ingredient-search";
import type { Cookbook, RecipeListItem } from "@/lib/types";
import { t } from "@/i18n";

const gridVariants: Variants = {
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
  const [have, setHave] = useState<string[]>([]);
  const [haveOpen, setHaveOpen] = useState(false);
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

  // "What do you have?": full matches first, then recipes missing only one or two things
  const missingById = new Map<string, string[]>();
  let full = filtered;
  let partial: RecipeListItem[] = [];
  if (have.length) {
    full = [];
    for (const r of filtered) {
      const { missing } = matchIngredients(r.ingredients, have);
      if (missing.length === 0) full.push(r);
      else if (missing.length <= allowedMissing(have.length) && missing.length < have.length) {
        partial.push(r);
        missingById.set(r.id, missing);
      }
    }
    partial = partial.sort((a, b) => missingById.get(a.id)!.length - missingById.get(b.id)!.length);
  }

  const grid = (items: RecipeListItem[], key: string) => (
    <motion.ul
      key={key}
      variants={gridVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      <AnimatePresence>
        {items.map((recipe) => (
          <motion.li key={recipe.id} variants={card} layout exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}>
            <RecipeCard
              recipe={recipe}
              missing={missingById.get(recipe.id)}
              removableFrom={removableFrom}
              onRemoved={() => setRemoved((ids) => [...ids, recipe.id])}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
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
        <div className="flex gap-2">
        <motion.button
          type="button"
          onClick={() => setHaveOpen((o) => !o)}
          whileTap={{ scale: 0.95 }}
          transition={spring}
          aria-expanded={haveOpen}
          title={t.search.toggle}
          className={`btn shrink-0 ${haveOpen || have.length ? "bg-forest-700 text-cream" : "border border-line bg-cream text-forest-800 shadow-soft"}`}
        >
          🧺 <span className="hidden sm:inline">{t.search.haveTitle}</span>
          {have.length > 0 && <span className="rounded-full bg-cream/25 px-1.5 text-xs">{have.length}</span>}
        </motion.button>
        <div className="relative flex-1 sm:w-72">
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
      </div>

      <AnimatePresence initial={false}>
        {haveOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <HavePanel items={have} onChange={setHave} />
          </motion.div>
        )}
      </AnimatePresence>

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

      {have.length > 0 ? (
        full.length === 0 && partial.length === 0 ? (
          <p className="py-16 text-center text-muted">{t.search.noMatches}</p>
        ) : (
          <div className="space-y-8">
            {full.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-serif text-xl font-semibold text-forest-900">✓ {t.search.fullMatches}</h2>
                {grid(full, `full-${have.join()}-${category}-${cookbookId}-${q}`)}
              </section>
            )}
            {partial.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-serif text-xl font-semibold text-forest-900">≈ {t.search.partialMatches}</h2>
                {grid(partial, `partial-${have.join()}-${category}-${cookbookId}-${q}`)}
              </section>
            )}
          </div>
        )
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">{t.recipes.noResults}</p>
      ) : (
        grid(filtered, `${category}-${cookbookId}-${q}`)
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

function RecipeCard({ recipe, missing, removableFrom, onRemoved }: { recipe: RecipeListItem; missing?: string[]; removableFrom?: string; onRemoved: () => void }) {
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
          {missing && <p className="text-xs font-medium text-amber-700">{t.search.missing(missing.join(", "))}</p>}
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

function HavePanel({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...items];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setInput("");
  };

  return (
    <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
      <div>
        <h2 className="font-serif text-lg font-semibold text-forest-900">🧺 {t.search.haveTitle}</h2>
        <p className="text-sm text-muted">{t.search.haveHint}</p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="input bg-white/70"
          value={input}
          placeholder={t.search.havePlaceholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !input && items.length) onChange(items.slice(0, -1));
          }}
          autoFocus
        />
        <button className="btn-primary shrink-0" disabled={!input.trim()}>{t.search.add}</button>
      </form>
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.button
                key={item}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={spring}
                onClick={() => onChange(items.filter((x) => x !== item))}
                className="flex items-center gap-1.5 rounded-full bg-forest-700 px-3 py-1 text-sm text-cream shadow-soft hover:bg-forest-800"
              >
                {item} <span aria-hidden>✕</span>
              </motion.button>
            ))}
          </AnimatePresence>
          <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => onChange([])}>
            {t.search.clear}
          </button>
        </div>
      )}
    </div>
  );
}

function totalTime(r: RecipeListItem) {
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return total ? `${total} ${t.common.minutes}` : "";
}
