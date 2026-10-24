"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, use, useMemo, useState } from "react";
import { spring } from "@/components/motion";
import { ingredientActions } from "@/features/registry";
import { scaleIngredient } from "@/lib/scale-ingredients";
import { useI18n } from "@/i18n/client";

type RecipeBasics = { title: string; ingredients: string[]; steps: string[]; servings: number | null };

type ScaleState = {
  recipe: RecipeBasics;
  /** Selected servings, or (if the recipe has no servings) a multiplier. */
  amount: number;
  setAmount: (n: number) => void;
  factor: number;
  scaled: string[];
};

const ScaleContext = createContext<ScaleState | null>(null);

/** Holds the selected number of servings for everything on the recipe page. */
export function ScaleProvider({ recipe, children }: { recipe: RecipeBasics; children: React.ReactNode }) {
  const { locale } = useI18n();
  const [amount, setAmount] = useState(recipe.servings ?? 1);
  // The page stays alive while the recipe is edited: start over when its servings change
  const [baseServings, setBaseServings] = useState(recipe.servings);
  if (baseServings !== recipe.servings) {
    setBaseServings(recipe.servings);
    setAmount(recipe.servings ?? 1);
  }
  const factor = recipe.servings ? amount / recipe.servings : amount;
  const scaled = useMemo(() => recipe.ingredients.map((i) => scaleIngredient(i, factor, locale)), [recipe.ingredients, factor, locale]);
  return <ScaleContext value={{ recipe, amount, setAmount, factor, scaled }}>{children}</ScaleContext>;
}

export function useScale() {
  const ctx = use(ScaleContext);
  if (!ctx) throw new Error("useScale must be used inside ScaleProvider");
  return ctx;
}

const MULTIPLIERS = [0.5, 1, 1.5, 2, 3, 4];

/** − n + counter for servings (or ×½ … ×4 if the recipe has no servings). */
export function ServingsStepper({ large }: { large?: boolean }) {
  const { t, locale } = useI18n();
  const { recipe, amount, setAmount } = useScale();
  const byServings = recipe.servings !== null;

  const step = (dir: 1 | -1) => {
    if (byServings) setAmount(Math.max(1, amount + dir));
    else {
      const i = MULTIPLIERS.indexOf(amount);
      setAmount(MULTIPLIERS[Math.min(MULTIPLIERS.length - 1, Math.max(0, i + dir))]);
    }
  };
  const label = byServings ? String(amount) : `×${String(amount).replace(".", locale === "de" ? "," : ".")}`;
  const size = large ? "size-12 text-2xl" : "size-11 text-lg sm:size-9";

  return (
    <div className="flex items-center gap-2 print:hidden">
      <span className="text-sm text-muted">{byServings ? t.view.servingsFor : t.view.amount}</span>
      <div className="flex items-center gap-1 rounded-full bg-sage-100 p-1">
        <motion.button
          type="button"
          aria-label={t.view.fewer}
          whileTap={{ scale: 0.85 }}
          transition={spring}
          onClick={() => step(-1)}
          className={`flex ${size} items-center justify-center rounded-full bg-cream text-forest-800 shadow-soft hover:bg-white`}
        >
          −
        </motion.button>
        <span className={`relative ${large ? "w-14 text-2xl" : "w-10 text-base"} overflow-hidden text-center font-semibold text-forest-900`}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              className="block"
              initial={{ y: -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 14, opacity: 0 }}
              transition={spring}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <motion.button
          type="button"
          aria-label={t.view.more}
          whileTap={{ scale: 0.85 }}
          transition={spring}
          onClick={() => step(1)}
          className={`flex ${size} items-center justify-center rounded-full bg-cream text-forest-800 shadow-soft hover:bg-white`}
        >
          +
        </motion.button>
      </div>
    </div>
  );
}

/** The ingredients card on the recipe page, scaled to the selected servings. */
export function IngredientsCard() {
  const { t, p } = useI18n();
  const { recipe, scaled, factor, amount } = useScale();
  return (
    <section className="card h-fit p-5 sm:p-6 lg:sticky lg:top-24 print:static print:border-0 print:p-0 print:shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-forest-900">{t.recipes.ingredients}</h2>
        <ServingsStepper />
        {recipe.servings && <span className="hidden text-sm print:inline">{p(t.recipes.servingsCount, amount)}</span>}
      </div>
      <AnimatePresence>
        {factor !== 1 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 text-xs font-medium text-moss-600 print:hidden"
          >
            ✦ {t.view.scaled}
          </motion.p>
        )}
      </AnimatePresence>
      <ul className="divide-y divide-line">
        {scaled.map((item, i) => (
          <li key={i} className="group flex items-start gap-3 py-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-matcha-500" />
            <motion.span key={item} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="flex-1">
              {item}
            </motion.span>
            {ingredientActions.map((Action, j) => (
              <span key={j} className="print:hidden">
                <Action ingredient={item} recipe={recipe} />
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
