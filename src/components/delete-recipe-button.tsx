"use client";

import { useState, useTransition } from "react";
import { deleteRecipe } from "@/app/actions/recipes";
import { ConfirmDialog } from "@/components/dialog";
import { useI18n } from "@/i18n/client";

/** `collectionCount`: in how many collections (besides the main cookbook) the recipe appears. */
export function DeleteRecipeButton({ id, collectionCount = 0 }: { id: string; collectionCount?: number }) {
  const { t, p } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn-danger" onClick={() => setOpen(true)}>{t.common.delete}</button>
      <ConfirmDialog
        open={open}
        message={collectionCount > 0 ? p(t.recipes.deleteConfirmIn, collectionCount + 1) : t.recipes.deleteConfirm}
        confirmLabel={t.common.delete}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => startTransition(() => deleteRecipe(id))}
      />
    </>
  );
}
