"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { copyRecipe } from "@/app/actions/recipes";
import { Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import type { Cookbook } from "@/lib/types";
import { t } from "@/i18n";

export function CopyRecipeButton({ recipeId, cookbooks, primary }: { recipeId: string; cookbooks: Pick<Cookbook, "id" | "name" | "emoji">[]; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(cookbooks[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (cookbooks.length === 0) return null;

  return (
    <>
      <button className={primary ? "btn-primary" : "btn-secondary"} onClick={() => setOpen(true)}>
        ⧉ {t.recipes.copyToMine}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="w-full max-w-md p-6">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">{t.recipes.copyTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.recipes.copyHint}</p>
        <div className="mt-4 space-y-2">
          {cookbooks.map((b) => (
            <motion.label
              key={b.id}
              whileHover={{ x: 3 }}
              transition={spring}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                target === b.id ? "border-forest-700 bg-sage-100" : "border-line bg-cream hover:bg-sage-50"
              }`}
            >
              <input type="radio" name="target" className="sr-only" checked={target === b.id} onChange={() => setTarget(b.id)} />
              <span className="text-xl">{b.emoji}</span>
              <span className="font-medium text-forest-900">{b.name}</span>
            </motion.label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>{t.common.cancel}</button>
          <button
            className="btn-primary"
            disabled={pending || !target}
            onClick={() =>
              startTransition(async () => {
                const result = await copyRecipe(recipeId, target);
                if (result?.error) setError(result.error);
              })
            }
          >
            {pending ? t.recipes.copying : t.recipes.copy}
          </button>
        </div>
      </Dialog>
    </>
  );
}
