"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { RecipeListItem } from "@/lib/types";
import { t } from "@/i18n";

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
    <div className="space-y-4">
      <input
        className="input"
        type="search"
        placeholder={t.recipes.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "__all"}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                category === c ? "border-accent bg-accent text-white" : "border-line bg-white hover:border-accent"
              }`}
            >
              {c ?? t.recipes.all}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted">{t.recipes.noResults}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <Link href={`/recipes/${recipe.id}`} className="card group block overflow-hidden">
                <div className="relative aspect-[4/3] bg-line/50">
                  {recipe.coverUrl ? (
                    <Image src={recipe.coverUrl} alt="" fill unoptimized className="object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-serif text-4xl text-muted/40">
                      {recipe.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 font-medium leading-snug">{recipe.title}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {[recipe.category, totalTime(recipe)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function totalTime(r: RecipeListItem) {
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return total ? `${total} ${t.common.minutes}` : "";
}
