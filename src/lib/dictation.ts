import type { Locale } from "@/i18n/config";

/** Language tags for the browser's speech recognition. */
export const SPEECH_LANGS: Record<Locale, string> = { de: "de-DE", en: "en-US", it: "it-IT" };

/**
 * Adds dictated text to what is already in a field: on a new line ("lines",
 * e.g. ingredients) or as a continuation with a space, starting new sentences
 * with a capital letter.
 */
export function appendDictation(current: string, spoken: string, mode: "text" | "lines" = "text"): string {
  const words = spoken.replace(/\s+/g, " ").trim();
  if (!words) return current;
  const base = current.replace(/[ \t]+$/, "");
  if (!base.trim()) return capitalize(words);
  if (mode === "lines") return `${base.replace(/\n+$/, "")}\n${capitalize(words)}`;
  if (base.endsWith("\n")) return base + capitalize(words);
  const sentenceEnded = /[.!?:]$/.test(base);
  return `${base} ${sentenceEnded ? capitalize(words) : words}`;
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
