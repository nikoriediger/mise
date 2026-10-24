"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setRecipeCollections } from "@/app/actions/recipes";
import { Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import type { Cookbook } from "@/lib/types";
import { t } from "@/i18n";

type Props = {
  recipeId: string;
  /** Whether the current user owns the recipe (then it's always in their main cookbook). */
  isMine: boolean;
  /** The user's own cookbooks (same family as the recipe). */
  cookbooks: Cookbook[];
  /** Ids of the user's collections that currently contain the recipe. */
  selected: string[];
};

/** "Add to cookbook": choose which of your collections contain this recipe. */
export function CookbookMembershipButton({ recipeId, isMine, cookbooks, selected }: Props) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>(selected);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const main = cookbooks.find((b) => b.is_default);
  const collections = cookbooks.filter((b) => !b.is_default);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <>
      <button
        className="btn-secondary"
        onClick={() => {
          setChecked(selected);
          setError("");
          setOpen(true);
        }}
      >
        ＋ {t.recipes.addToCookbook}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="w-full max-w-md p-6">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">{t.recipes.addToCookbookTitle}</h2>
        <div className="mt-4 space-y-2">
          {isMine && main && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-sage-50 px-3 py-2.5 opacity-80">
              <span className="flex size-5 items-center justify-center rounded-md bg-forest-700 text-xs text-cream">✓</span>
              <span className="text-xl">{main.emoji}</span>
              <span className="min-w-0">
                <span className="block font-medium text-forest-900">{main.name}</span>
                <span className="block text-xs text-muted">{t.recipes.mainCookbookHint}</span>
              </span>
            </div>
          )}
          {collections.map((b) => {
            const on = checked.includes(b.id);
            return (
              <motion.label
                key={b.id}
                whileHover={{ x: 3 }}
                transition={spring}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  on ? "border-forest-700 bg-sage-100" : "border-line bg-cream hover:bg-sage-50"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(b.id)} />
                <motion.span
                  className={`flex size-5 items-center justify-center rounded-md border text-xs ${on ? "border-forest-700 bg-forest-700 text-cream" : "border-sage-300 bg-white"}`}
                  animate={{ scale: on ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.25 }}
                >
                  {on && "✓"}
                </motion.span>
                <span className="text-xl">{b.emoji}</span>
                <span className="font-medium text-forest-900">{b.name}</span>
              </motion.label>
            );
          })}
          {collections.length === 0 && (
            <Link href="/cookbooks" className="block rounded-xl border border-dashed border-sage-300 px-3 py-3 text-center text-sm text-muted hover:bg-sage-50">
              ＋ {t.cookbooks.create}
            </Link>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>{t.common.cancel}</button>
          <button
            className="btn-primary"
            disabled={pending || collections.length === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await setRecipeCollections(recipeId, checked);
                if (result?.error) setError(result.error);
                else setOpen(false);
              })
            }
          >
            {pending ? t.common.saving : t.common.save}
          </button>
        </div>
      </Dialog>
    </>
  );
}
