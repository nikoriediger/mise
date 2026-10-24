"use client";

import { useI18n } from "@/i18n/client";

/** Shown in place of the recipe scanner when no scanning tool is installed. */
export function PremiumScanTeaser() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-dashed border-sage-300 bg-gradient-to-br from-cream to-mint-100/60 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-200 text-xl grayscale-[30%]">✨</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-forest-900">{t.premium.scanTitle}</h2>
            <span className="rounded-full bg-gradient-to-r from-matcha-400 to-moss-500 px-2.5 py-0.5 text-xs font-semibold text-cream shadow-soft">
              {t.premium.badge}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{t.premium.scanText}</p>
          <button type="button" disabled className="btn-secondary mt-3">
            {t.premium.soon}
          </button>
        </div>
      </div>
    </section>
  );
}
