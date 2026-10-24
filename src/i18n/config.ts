export const locales = ["de", "en", "it"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Default UI language of this deployment (NEXT_PUBLIC_APP_LOCALE), German otherwise. */
export const defaultLocale: Locale = isLocale(process.env.NEXT_PUBLIC_APP_LOCALE) ? process.env.NEXT_PUBLIC_APP_LOCALE : "de";

/** Cookie that stores the chosen UI language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const appName = process.env.NEXT_PUBLIC_APP_NAME || "mise";

export const localeFlags: Record<Locale, string> = { de: "🇩🇪", en: "🇬🇧", it: "🇮🇹" };

/** Picks the best supported language from an Accept-Language header. */
export function matchAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return wanted.find((w) => isLocale(w.lang))?.lang as Locale | undefined ?? null;
}
