"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { removeFromCookbook } from "@/app/actions/recipes";
import { Avatar } from "@/components/avatar";
import { FavoriteButton } from "@/components/favorite-button";
import { spring } from "@/components/motion";
import { allowedMissing, matchIngredients } from "@/lib/ingredient-search";
import { CATEGORIES, DIETS, categoryEmoji, dietEmoji, type DietKey } from "@/lib/taxonomy";
import type { Cookbook, RecipeListItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { localeFlags, type Locale } from "@/i18n/config";

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
  const { t, p } = useI18n();
  const [query, setQuery] = useState("");
  // Several categories = any of them; several diet flags = all of them
  const [cats, setCats] = useState<string[]>([]);
  const [diets, setDiets] = useState<DietKey[]>([]);
  const [cookbookId, setCookbookId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Locale | null>(null);
  const [quick, setQuick] = useState<"favorites" | "recent" | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [have, setHave] = useState<string[]>([]);
  const [haveOpen, setHaveOpen] = useState(false);
  const categoryOptions = useMemo(() => {
    const used = new Set(recipes.flatMap((r) => r.categories));
    const options = CATEGORIES.filter((c) => used.has(c.key)).map((c) => ({ value: c.key as string, label: `${c.emoji} ${t.categories[c.key]}` }));
    if (options.length && recipes.some((r) => r.categories.length === 0)) options.push({ value: NO_CATEGORY, label: t.recipes.uncategorized });
    return options;
  }, [recipes, t]);
  const dietOptions = useMemo(() => {
    const used = new Set(recipes.flatMap((r) => r.diet));
    return DIETS.filter((d) => used.has(d.key)).map((d) => ({ value: d.key, label: `${d.emoji} ${t.diet[d.key]}` }));
  }, [recipes, t]);
  const filterKey = [...cats, ...diets].join();
  const showCookbooks = standalone && cookbooks.length > 1;
  const languages = useMemo(
    () => [...new Set(recipes.map((r) => r.language).filter((l): l is Locale => Boolean(l)))].sort(),
    [recipes],
  );

  const q = query.trim().toLowerCase();
  const filtered = recipes
    .filter((r) => (quick === "favorites" ? r.is_favorite : quick === "recent" ? Boolean(r.last_cooked) : true))
    .sort((a, b) => (quick === "recent" ? (b.last_cooked ?? "").localeCompare(a.last_cooked ?? "") : 0))
    .filter(
    (r) =>
      !removed.includes(r.id) &&
      (!cats.length || cats.some((c) => (c === NO_CATEGORY ? r.categories.length === 0 : r.categories.includes(c as never)))) &&
      diets.every((d) => r.diet.includes(d)) &&
      (!cookbookId || r.cookbook_ids.includes(cookbookId)) &&
      (!language || r.language === language) &&
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
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
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
            <p className="mt-1 text-sm text-muted">{p(t.recipes.count, recipes.length)}</p>
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

      {standalone && (
        <FilterChips
          layoutId="quick-pill"
          value={quick}
          onChange={setQuick}
          options={[
            { value: null, label: t.recipes.all },
            { value: "favorites", label: t.favorites.filter },
            { value: "recent", label: t.favorites.recentlyCooked },
          ]}
        />
      )}
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
      {languages.length > 1 && (
        <FilterChips
          layoutId="language-pill"
          value={language}
          onChange={setLanguage}
          options={[{ value: null, label: t.recipes.allLanguages }, ...languages.map((l) => ({ value: l, label: `${localeFlags[l]} ${t.lang[l]}` }))]}
        />
      )}
      {categoryOptions.length > 0 && (
        <MultiChips label={t.recipes.categories} allLabel={t.recipes.all} value={cats} onChange={setCats} options={categoryOptions} />
      )}
      {dietOptions.length > 0 && (
        <MultiChips label={t.recipes.diet} allLabel={t.recipes.all} value={diets} onChange={setDiets} options={dietOptions} />
      )}

      {have.length > 0 ? (
        full.length === 0 && partial.length === 0 ? (
          <p className="py-16 text-center text-muted">{t.search.noMatches}</p>
        ) : (
          <div className="space-y-8">
            {full.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-serif text-xl font-semibold text-forest-900">✓ {t.search.fullMatches}</h2>
                {grid(full, `full-${have.join()}-${filterKey}-${cookbookId}-${language}-${q}`)}
              </section>
            )}
            {partial.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-serif text-xl font-semibold text-forest-900">≈ {t.search.partialMatches}</h2>
                {grid(partial, `partial-${have.join()}-${filterKey}-${cookbookId}-${language}-${q}`)}
              </section>
            )}
          </div>
        )
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">{quick === "favorites" && !q ? t.favorites.none : t.recipes.noResults}</p>
      ) : (
        grid(filtered, `${filterKey}-${cookbookId}-${language}-${quick}-${q}`)
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
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {props.options.map((option) => {
        const active = props.value === option.value;
        return (
          <motion.button
            key={option.value ?? "__all"}
            onClick={() => props.onChange(option.value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className={`relative min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
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

const NO_CATEGORY = "__none";

function MultiChips<T extends string>(props: {
  label: string;
  allLabel: string;
  value: T[];
  onChange: (value: T[]) => void;
  options: { value: T; label: string }[];
}) {
  const chip = (active: boolean) =>
    `min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
      active ? "bg-forest-700 text-cream shadow-soft" : "bg-cream/70 text-forest-800 shadow-soft hover:bg-cream"
    }`;
  return (
    <div role="group" aria-label={props.label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <motion.button type="button" aria-pressed={!props.value.length} onClick={() => props.onChange([])} whileTap={{ scale: 0.95 }} transition={spring} className={chip(!props.value.length)}>
        {props.allLabel}
      </motion.button>
      {props.options.map((option) => {
        const active = props.value.includes(option.value);
        return (
          <motion.button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => props.onChange(active ? props.value.filter((v) => v !== option.value) : [...props.value, option.value])}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className={chip(active)}
          >
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function RecipeCard({ recipe, missing, removableFrom, onRemoved }: { recipe: RecipeListItem; missing?: string[]; removableFrom?: string; onRemoved: () => void }) {
  const { t, f, locale } = useI18n();
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
          <span className="absolute left-2 top-2 flex max-w-[calc(100%-3.5rem)] gap-1">
            {recipe.categories[0] && (
              <span className="glass truncate rounded-full px-2.5 py-0.5 text-xs font-medium text-forest-800">
                {categoryEmoji(recipe.categories[0])} {t.categories[recipe.categories[0]]}
                {recipe.categories.length > 1 && ` +${recipe.categories.length - 1}`}
              </span>
            )}
            {recipe.diet.length > 0 && (
              <span className="glass shrink-0 rounded-full px-2 py-0.5 text-xs" title={recipe.diet.map((d) => t.diet[d]).join(", ")}>
                {/* vegan already says vegetarian */}
                {recipe.diet.filter((d) => !(d === "vegetarian" && recipe.diet.includes("vegan"))).map(dietEmoji).join("")}
              </span>
            )}
            {recipe.language && recipe.language !== locale && (
              <span className="glass shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-forest-800" title={t.lang[recipe.language]}>
                {localeFlags[recipe.language]}
              </span>
            )}
          </span>
        </div>
        <div className="space-y-1.5 p-3.5 pr-12">
          <h2 className="line-clamp-2 font-medium leading-snug text-forest-900">{recipe.title}</h2>
          {!recipe.is_mine && recipe.owner_name && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-sage-100/90 px-2.5 py-0.5 text-xs font-medium text-forest-800">
              <Avatar url={recipe.owner_avatar} name={recipe.owner_name} size="xs" /> <span className="truncate">{recipe.owner_name}</span> <span title={t.recipes.readOnly}>🔒</span>
            </span>
          )}
          {totalTime(recipe, t.common.minutes) && <p className="text-xs text-muted">⏱ {totalTime(recipe, t.common.minutes)}</p>}
          {missing && <p className="text-xs font-medium text-amber-700">{f(t.search.missing, { items: missing.join(", ") })}</p>}
        </div>
      </Link>
      <span className="absolute bottom-2 right-2">
        <FavoriteButton recipeId={recipe.id} initial={recipe.is_favorite} compact />
      </span>
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
          className="glass absolute right-1.5 top-1.5 flex size-10 items-center justify-center rounded-full text-sm text-forest-900 shadow-soft hover:bg-red-50 hover:text-red-700"
        >
          ✕
        </motion.button>
      )}
    </motion.div>
  );
}

function HavePanel({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const { t } = useI18n();
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
                className="flex min-h-10 items-center gap-1.5 rounded-full bg-forest-700 px-3.5 py-1 text-sm text-cream shadow-soft hover:bg-forest-800"
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

function totalTime(r: RecipeListItem, minutes: string) {
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return total ? `${total} ${minutes}` : "";
}
