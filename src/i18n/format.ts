import type { Locale } from "./config";
import type de from "./messages/de.json";

/** The shape of every language file (German is the reference). */
export type Messages = typeof de;

export type Plural = { one: string; other: string };
type Vars = Record<string, string | number>;

/** Replaces {placeholders}: f("Schritt {n}", { n: 2 }) -> "Schritt 2". */
export function format(template: string, vars: Vars = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export type Translator = {
  locale: Locale;
  t: Messages;
  /** Fills in placeholders. */
  f: (template: string, vars?: Vars) => string;
  /** Picks the plural form for n and fills in {n} (plus any other placeholders). */
  p: (plural: Plural, n: number, vars?: Vars) => string;
  /** Formats a date like "24. Okt. 2026". */
  date: (value: string | Date) => string;
};

const intlLocale: Record<Locale, string> = { de: "de-DE", en: "en-GB", it: "it-IT" };

export function createTranslator(locale: Locale, messages: Messages): Translator {
  const plurals = new Intl.PluralRules(intlLocale[locale]);
  return {
    locale,
    t: messages,
    f: format,
    p: (plural, n, vars) => format(plurals.select(n) === "one" ? plural.one : plural.other, { n, ...vars }),
    date: (value) =>
      new Date(value).toLocaleDateString(intlLocale[locale], { day: "numeric", month: "short", year: "numeric" }),
  };
}

/** Name for someone's main cookbook, e.g. "Nikos Kochbuch" / "Niko's cookbook" / "Il ricettario di Niko". */
export function cookbookDefaultName(t: Messages, name: string) {
  if (!name) return t.cookbooks.defaultNameEmpty;
  const template = /[sßxz]$/i.test(name) ? t.cookbooks.defaultNameSibilant : t.cookbooks.defaultName;
  return format(template, { name });
}
