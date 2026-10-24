/**
 * Turns ingredient lines into shopping list entries that can be added up:
 * "300 g Mehl" + "0,2 kg Mehl" -> "500 g Mehl"; "2 Eier" + "3 Eier" -> "5 Eier".
 */
import { stem } from "./ingredient-search";
import { parseIngredient } from "./scale-ingredients";

type Locale = "de" | "en" | "it";

/** Units converted to a base unit before adding up. */
const BASE: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  gr: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  mg: { base: "g", factor: 0.001 },
  ml: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  dl: { base: "ml", factor: 100 },
  l: { base: "ml", factor: 1000 },
};

export type ShoppingEntry = {
  name: string;
  amount: number | null;
  unit: string | null;
  merge_key: string;
};

function normalizeName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => stem(w))
    .join(" ");
}

/** Parses an (already scaled) ingredient line into an entry. */
export function toShoppingEntry(line: string): ShoppingEntry {
  const text = line.trim().replace(/^≈\s*/, "");
  const parsed = parseIngredient(text);
  if (!parsed) {
    return { name: text, amount: null, unit: null, merge_key: `${normalizeName(text)}|` };
  }
  let rest = parsed.rest.trim();
  let unit: string | null = null;
  if (parsed.unit) {
    unit = parsed.unit;
    rest = rest.replace(/^[a-zA-ZäöüÄÖÜß]+\.?\s*/, "");
  }
  let amount = parsed.max ?? parsed.min;
  const base = unit ? BASE[unit] : undefined;
  if (base) {
    amount *= base.factor;
    unit = base.base;
  }
  const name = rest || text;
  return { name, amount, unit, merge_key: `${normalizeName(name)}|${unit ?? ""}` };
}

/** Adds an entry's amount to an existing one (same merge_key). */
export function mergeAmounts(a: number | null, b: number | null) {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

const SPOON_UNITS: Record<string, string> = { el: "EL", tl: "TL", tbsp: "tbsp", tsp: "tsp" };

/** "1500 g" -> "1,5 kg", "0.5 tl" -> "½ TL" */
export function formatAmount(amount: number | null, unit: string | null, locale: Locale = "de") {
  if (amount === null) return "";
  const metric = unit === "g" || unit === "ml";
  let value = amount;
  let shownUnit = unit ?? "";
  if (metric && amount >= 1000) {
    value = amount / 1000;
    shownUnit = unit === "g" ? "kg" : "l";
  } else if (unit && SPOON_UNITS[unit]) {
    shownUnit = SPOON_UNITS[unit];
  } else if (unit && !metric) {
    shownUnit = unit.charAt(0).toUpperCase() + unit.slice(1) + (["pck", "stk", "msp"].includes(unit) ? "." : "");
  }

  const rounded = metric && shownUnit === unit && value >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  const decimal = locale === "en" ? String(rounded) : String(rounded).replace(".", ",");
  // Fractions read better for spoons, cups and pieces ("½ TL", "1 ¾ Tassen")
  const fractions: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
  const whole = Math.floor(rounded);
  const fraction = fractions[String(Math.round((rounded - whole) * 100) / 100)];
  const text = !metric && fraction ? `${whole ? `${whole} ` : ""}${fraction}` : decimal;
  return shownUnit ? `${text} ${shownUnit}` : text;
}

/** Display text of an item, e.g. "500 g Mehl". */
export function itemLabel(item: Pick<ShoppingEntry, "name" | "amount" | "unit">, locale: Locale = "de") {
  const amount = formatAmount(item.amount, item.unit, locale);
  return amount ? `${amount} ${item.name}` : item.name;
}
