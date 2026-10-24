import "server-only";
import { cookies } from "next/headers";
import { lang } from "next/root-params";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages } from "./dictionaries";
import { createTranslator, type Translator } from "./format";

/** The UI language of the current page (from the internal /[lang] segment). */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : defaultLocale;
}

/** Translator for Server Components and generateMetadata. */
export async function getI18n(): Promise<Translator> {
  const locale = await getLocale();
  return createTranslator(locale, getMessages(locale));
}

/** Translator for Server Actions and Route Handlers (root params aren't available there). */
export async function getActionI18n(): Promise<Translator> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  return createTranslator(locale, getMessages(locale));
}
