/**
 * Scales the quantity at the start of an ingredient line, e.g.
 * "200 g Mehl" × 1.5 -> "300 g Mehl", "1/2 TL Salz" × 2 -> "1 TL Salz".
 * Lines without a leading quantity ("Salz", "etwas Pfeffer") are returned unchanged.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4, "⅕": 1 / 5, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

// One amount: "1 1/2", "1 ½", "1½", "1/2", "½", "0,5", "1.5", "2"
const AMOUNT = `(?:\\d+\\s*[${FRACTION_CHARS}]|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|[${FRACTION_CHARS}]|\\d+(?:[.,]\\d+)?)`;
const LEADING = new RegExp(`^(\\s*)(${AMOUNT})(?:\\s*(?:-|–|bis|to)\\s*(${AMOUNT}))?(?=\\s|$|[a-zA-ZäöüÄÖÜß])`);

/** Metric units that are rounded to sensible steps (and converted to kg/l when large). */
const METRIC: Record<string, { step: (n: number) => number; big?: { unit: string; factor: number } }> = {
  g: { step: metricStep, big: { unit: "kg", factor: 1000 } },
  gr: { step: metricStep, big: { unit: "kg", factor: 1000 } },
  ml: { step: metricStep, big: { unit: "l", factor: 1000 } },
  mg: { step: metricStep },
  kg: { step: (n) => roundTo(n, n < 1 ? 0.05 : 0.1) },
  l: { step: (n) => roundTo(n, n < 1 ? 0.05 : 0.1) },
  cl: { step: (n) => roundTo(n, 1) },
  dl: { step: (n) => roundTo(n, 0.5) },
};

/** Units for which fractions (½, ¼ …) read better than decimals. */
const UNITS = new Set([
  "el", "tl", "msp", "prise", "prisen", "tasse", "tassen", "becher", "dose", "dosen", "pck", "päckchen", "packung", "packungen",
  "bund", "zehe", "zehen", "scheibe", "scheiben", "stück", "stk", "glas", "gläser", "würfel", "blatt", "blätter", "zweig", "zweige",
  "handvoll", "schuss", "spritzer", "tropfen", "cup", "cups", "tbsp", "tsp", "oz", "lb", "lbs", "pinch", "can", "cans", "clove", "cloves",
  "slice", "slices", "stick", "sticks", "pint", "pints", "quart", "quarts", "dash",
]);

export type ParsedIngredient = {
  /** Text before the quantity (usually whitespace). */
  lead: string;
  min: number;
  max: number | null;
  /** The unit right after the quantity, lowercased and without a trailing dot ("g", "el", ...), if any. */
  unit: string | null;
  /** Everything after the quantity, including the unit. */
  rest: string;
};

export function parseIngredient(line: string): ParsedIngredient | null {
  const match = LEADING.exec(line);
  if (!match) return null;
  const min = parseAmount(match[2]);
  const max = match[3] ? parseAmount(match[3]) : null;
  if (min === null || (match[3] && max === null)) return null;

  const rest = line.slice(match[0].length);
  const unitMatch = /^\s*([a-zA-ZäöüÄÖÜß]+)\.?/.exec(rest);
  const word = unitMatch?.[1].toLowerCase() ?? null;
  const unit = word && (word in METRIC || UNITS.has(word)) ? word : null;
  return { lead: match[1], min, max, unit, rest };
}

export function scaleIngredient(line: string, factor: number, locale: "de" | "en" = "de"): string {
  if (factor === 1) return line;
  const parsed = parseIngredient(line);
  if (!parsed) return line;

  let { unit, rest } = parsed;
  let min = parsed.min * factor;
  let max = parsed.max === null ? null : parsed.max * factor;
  let approx = false;

  const metric = unit ? METRIC[unit] : undefined;
  if (metric?.big && Math.min(min, max ?? min) >= metric.big.factor) {
    // 1500 g -> 1,5 kg
    min /= metric.big.factor;
    max = max === null ? null : max / metric.big.factor;
    rest = rest.replace(/^(\s*)[a-zA-Z]+\.?/, `$1${metric.big.unit}`);
    unit = metric.big.unit;
  }

  const format = (n: number) => {
    const m = unit ? METRIC[unit] : undefined;
    if (m) return formatDecimal(m.step(n), locale);
    if (unit) return formatFraction(n);
    // Countable things without a unit ("3 Eier"): whole numbers
    const whole = Math.max(1, Math.round(n));
    if (Math.abs(whole - n) > 0.01) approx = true;
    return String(whole);
  };

  const amount = max === null ? format(min) : `${format(min)}–${format(max)}`;
  return `${parsed.lead}${approx ? "≈ " : ""}${amount}${rest}`;
}

function parseAmount(text: string): number | null {
  const s = text.replace(/\s+/g, " ").trim();
  let m = /^(\d+) ?([½⅓⅔¼¾⅕⅛⅜⅝⅞])$/.exec(s);
  if (m) return Number(m[1]) + UNICODE_FRACTIONS[m[2]];
  m = /^(\d+) (\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  m = /^(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  if (s in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[s];
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function metricStep(n: number) {
  if (n < 10) return roundTo(n, 0.5);
  if (n < 100) return roundTo(n, 1);
  if (n < 250) return roundTo(n, 5);
  return roundTo(n, 10);
}

function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step);
}

function formatDecimal(n: number, locale: "de" | "en") {
  const text = String(Math.round(n * 100) / 100);
  return locale === "de" ? text.replace(".", ",") : text;
}

const FRACTIONS: [number, string][] = [
  [0, ""], [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"], [1, ""],
];

function formatFraction(n: number) {
  let whole = Math.floor(n);
  const frac = n - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (best[0] === 1) whole += 1;
  if (whole === 0 && best[1] === "") return "¼"; // never show 0
  if (whole === 0) return best[1];
  return best[1] ? `${whole} ${best[1]}` : String(whole);
}

/** "1,5" -> 1.5 servings factor helper for UI: the factor for going from `base` to `target` servings. */
export function scaleFactor(base: number | null, target: number) {
  return base ? target / base : target;
}
