"use client";

import { useState, useTransition } from "react";
import { copyRecipe } from "@/app/actions/recipes";
import { Dialog } from "@/components/dialog";
import { useI18n } from "@/i18n/client";

/** Copies someone else's recipe as the user's own and opens the copy for editing. */
export function CopyRecipeButton({ recipeId }: { recipeId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>✎ {t.recipes.editAsCopy}</button>
      <Dialog open={open} onClose={() => setOpen(false)} className="w-full max-w-md p-6">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">{t.recipes.editAsCopy}</h2>
        <p className="mt-2 text-sm text-muted">{t.recipes.editAsCopyHint}</p>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>{t.common.cancel}</button>
          <button
            className="btn-primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await copyRecipe(recipeId);
                if (result?.error) setError(result.error);
              })
            }
          >
            {pending ? t.recipes.copying : t.recipes.editAsCopy}
          </button>
        </div>
      </Dialog>
    </>
  );
}
