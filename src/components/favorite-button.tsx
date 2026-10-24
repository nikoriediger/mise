"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { setFavorite } from "@/app/actions/cooking";
import { useI18n } from "@/i18n/client";

/** Heart toggle; `compact` is the small round version for recipe cards. */
export function FavoriteButton({ recipeId, initial, compact }: { recipeId: string; initial: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const [on, setOn] = useState(initial);
  const [, startTransition] = useTransition();
  const label = on ? t.favorites.remove : t.favorites.add;

  return (
    <motion.button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        setOn(next);
        startTransition(async () => {
          const { ok } = await setFavorite(recipeId, next);
          if (!ok) setOn(!next);
        });
      }}
      className={
        compact
          ? "glass flex size-10 items-center justify-center rounded-full text-lg shadow-soft print:hidden"
          : "btn-secondary min-h-12 min-w-12 px-3 text-xl leading-none print:hidden"
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={on ? "on" : "off"}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className={on ? "text-red-600" : "text-forest-800"}
        >
          {on ? "♥" : "♡"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
