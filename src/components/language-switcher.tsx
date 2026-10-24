"use client";

import { motion } from "framer-motion";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { spring } from "@/components/motion";
import { useI18n } from "@/i18n/client";
import { localeFlags, locales, type Locale } from "@/i18n/config";

function useSwitch() {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const change = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      // The language is part of the (internal) root route, so reload the page fully.
      window.location.reload();
    });
  };
  return { locale, pending, change };
}

/** Large buttons, e.g. inside the mobile "More" sheet. */
export function LanguageList() {
  const { t } = useI18n();
  const { locale, pending, change } = useSwitch();
  return (
    <div role="radiogroup" aria-label={t.lang.title} className="grid gap-2">
      {locales.map((l) => {
        const active = l === locale;
        return (
          <motion.button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => change(l)}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left text-base transition-colors ${
              active ? "border-forest-700 bg-sage-100 font-semibold text-forest-900" : "border-line bg-cream text-forest-800 hover:bg-sage-50"
            }`}
          >
            <span className="text-2xl" aria-hidden>{localeFlags[l]}</span>
            <span className="flex-1">{t.lang[l]}</span>
            {active && <span className="text-forest-700">✓</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Compact segmented control (desktop header, login page). */
export function LanguageToggle() {
  const { t } = useI18n();
  const { locale, pending, change } = useSwitch();
  return (
    <div role="radiogroup" aria-label={t.lang.title} className="flex items-center gap-0.5 rounded-full bg-sage-100/80 p-1">
      {locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.lang[l]}
            title={t.lang[l]}
            disabled={pending}
            onClick={() => change(l)}
            className={`relative min-h-9 min-w-10 rounded-full px-2.5 text-xs font-semibold transition-colors ${
              active ? "text-cream" : "text-forest-800 hover:text-forest-900"
            }`}
          >
            {active && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-full bg-forest-700 shadow-soft" transition={spring} />}
            <span className="relative">{t.lang.short[l]}</span>
          </button>
        );
      })}
    </div>
  );
}
