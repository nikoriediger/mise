import { de } from "./de";
import { en, type Messages } from "./en";

const dictionaries = { en, de } satisfies Record<string, Messages>;

export type Locale = keyof typeof dictionaries;

export const locale: Locale =
  process.env.NEXT_PUBLIC_APP_LOCALE === "de" ? "de" : "en";

export const t: Messages = dictionaries[locale];

export const appName = process.env.NEXT_PUBLIC_APP_NAME || "mise";

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
