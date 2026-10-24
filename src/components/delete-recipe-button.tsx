"use client";

import { useState, useTransition } from "react";
import { deleteRecipe } from "@/app/actions/recipes";
import { ConfirmDialog } from "@/components/dialog";
import { t } from "@/i18n";

export function DeleteRecipeButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn-danger" onClick={() => setOpen(true)}>{t.common.delete}</button>
      <ConfirmDialog
        open={open}
        message={t.recipes.deleteConfirm}
        confirmLabel={t.common.delete}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => startTransition(() => deleteRecipe(id))}
      />
    </>
  );
}
