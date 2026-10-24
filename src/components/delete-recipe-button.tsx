"use client";

import { useTransition } from "react";
import { deleteRecipe } from "@/app/actions/recipes";
import { t } from "@/i18n";

export function DeleteRecipeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm(t.recipes.deleteConfirm)) {
          startTransition(() => deleteRecipe(id));
        }
      }}
    >
      {t.common.delete}
    </button>
  );
}
