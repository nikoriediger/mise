"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, useTransition } from "react";
import { addRecipesToCookbook } from "@/app/actions/recipes";
import { Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import type { RecipeListItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";

type Candidate = Pick<RecipeListItem, "id" | "title" | "owner_name" | "is_mine" | "coverUrl">;

/** Lets the owner of a collection add existing family recipes to it. */
export function RecipePickerButton({ cookbookId, cookbookName, candidates }: { cookbookId: string; cookbookName: string; candidates: Candidate[] }) {
  const { t, p, f } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const visible = candidates.filter((c) => !q || c.title.toLowerCase().includes(q) || c.owner_name.toLowerCase().includes(q));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <button
        className="btn-secondary"
        onClick={() => {
          setSelected([]);
          setQuery("");
          setError("");
          setOpen(true);
        }}
      >
        ＋ {t.cookbooks.addRecipes}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="flex max-h-[85vh] w-full max-w-2xl flex-col p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">{f(t.cookbooks.addRecipesTitle, { name: cookbookName })}</h2>
        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t.cookbooks.pickerEmpty}</p>
        ) : (
          <>
            <input className="input mt-4" type="search" placeholder={t.recipes.search} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <ul className="-mx-1 mt-3 grid flex-1 grid-cols-1 gap-2 overflow-y-auto px-1 py-1 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {visible.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <motion.li key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <motion.button
                        type="button"
                        onClick={() => toggle(c.id)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={spring}
                        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                          on ? "border-forest-700 bg-sage-100" : "border-line bg-cream hover:bg-sage-50"
                        }`}
                      >
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-sage-100 to-mint-100">
                          {c.coverUrl ? (
                            <Image src={c.coverUrl} alt="" fill unoptimized className="object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center font-serif text-lg text-sage-400">{c.title.charAt(0)}</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-forest-900">{c.title}</span>
                          <span className="block truncate text-xs text-muted">
                            {c.is_mine ? t.cookbooks.main : `👤 ${c.owner_name} · 🔒 ${t.recipes.readOnly}`}
                          </span>
                        </span>
                        <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-xs ${on ? "border-forest-700 bg-forest-700 text-cream" : "border-sage-300 bg-white"}`}>
                          {on && "✓"}
                        </span>
                      </motion.button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn-secondary" onClick={() => setOpen(false)}>{t.common.cancel}</button>
          <button
            className="btn-primary"
            disabled={pending || selected.length === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await addRecipesToCookbook(cookbookId, selected);
                if (result?.error) setError(result.error);
                else setOpen(false);
              })
            }
          >
            {pending ? t.common.saving : (selected.length ? p(t.cookbooks.addSelected, selected.length) : t.cookbooks.add)}
          </button>
        </div>
      </Dialog>
    </>
  );
}
