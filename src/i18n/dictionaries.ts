import "server-only";
import type { Locale } from "./config";
import type { Messages } from "./format";
import de from "./messages/de.json";
import en from "./messages/en.json";
import it from "./messages/it.json";

// Every language must have every key of the German reference file.
const dictionaries: Record<Locale, Messages> = { de, en, it };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
