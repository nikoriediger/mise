"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { useI18n } from "@/i18n/client";

/** "⋯" button that shows secondary actions in a bottom sheet (phones). */
export function ActionsSheet({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t.recipes.actions}
        title={t.recipes.actions}
        onClick={() => setOpen(true)}
        className="btn-secondary min-h-12 min-w-12 px-3 text-xl leading-none md:hidden print:hidden"
      >
        ⋯
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} className="px-5">
        <h2 className="mb-4 line-clamp-2 font-serif text-xl font-semibold text-forest-900">{title}</h2>
        {/* Children are regular action buttons; make them full-width list items here */}
        <div className="grid gap-2 [&_a]:min-h-12 [&_a]:w-full [&_a]:justify-start [&_a]:text-base [&>*>button]:min-h-12 [&>*>button]:w-full [&>*>button]:justify-start [&>*>button]:text-base [&>button]:min-h-12 [&>button]:w-full [&>button]:justify-start [&>button]:text-base">
          {children}
        </div>
      </Dialog>
    </>
  );
}
