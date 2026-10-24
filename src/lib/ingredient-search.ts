/**
 * Matching for "what do you have?" search: does a recipe use an ingredient?
 * Case- and accent-insensitive, tolerant of simple plurals ("Eier" ~ "Ei",
 * "Tomaten" ~ "Tomate") and compound words ("Mehl" ~ "Weizenmehl").
 */

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
}

/** Strips common German/English plural endings. */
export function stem(word: string) {
  const w = normalize(word).trim();
  for (const ending of ["ern", "en", "er", "es", "n", "e", "s"]) {
    if (w.length - ending.length >= 2 && w.endsWith(ending)) return w.slice(0, -ending.length);
  }
  return w;
}

function words(line: string) {
  return normalize(line).split(/[^a-z0-9]+/).filter(Boolean);
}

/** True if the ingredient line contains the searched ingredient. */
export function lineMatches(line: string, term: string) {
  const s = stem(term);
  if (!s) return false;
  return words(line).some((w) => w.startsWith(s) || (s.length >= 4 && w.endsWith(s)) || (s.length >= 4 && w.includes(s)));
}

export type HaveMatch = { matched: string[]; missing: string[] };

export function matchIngredients(ingredients: string[], terms: string[]): HaveMatch {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const term of terms) (ingredients.some((line) => lineMatches(line, term)) ? matched : missing).push(term);
  return { matched, missing };
}

/** How many missing ingredients still count as "almost there". */
export function allowedMissing(termCount: number) {
  if (termCount < 2) return 0;
  return termCount >= 4 ? 2 : 1;
}
