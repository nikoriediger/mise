/**
 * Fixed recipe categories and diet flags. The keys are stored in the database
 * (see the check constraints on public.recipes); labels come from i18n
 * (`categories.*`, `diet.*`).
 */

export const CATEGORIES = [
  { key: "breakfast", emoji: "🥐" },
  { key: "starters", emoji: "🥟" },
  { key: "salads", emoji: "🥗" },
  { key: "soups", emoji: "🍲" },
  { key: "mains", emoji: "🍽️" },
  { key: "pasta", emoji: "🍝" },
  { key: "sides", emoji: "🥔" },
  { key: "bread", emoji: "🍞" },
  { key: "cakes", emoji: "🎂" },
  { key: "cookies", emoji: "🍪" },
  { key: "desserts", emoji: "🍮" },
  { key: "sauces", emoji: "🥫" },
  { key: "drinks", emoji: "🍹" },
] as const;

export const DIETS = [
  { key: "meat", emoji: "🥩" },
  { key: "fish", emoji: "🐟" },
  { key: "vegetarian", emoji: "🌱" },
  { key: "vegan", emoji: "🌿" },
  { key: "gluten_free", emoji: "🌾" },
  { key: "lactose_free", emoji: "🥛" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export type DietKey = (typeof DIETS)[number]["key"];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as CategoryKey[];
export const DIET_KEYS = DIETS.map((d) => d.key) as DietKey[];

export const categoryEmoji = (key: string) => CATEGORIES.find((c) => c.key === key)?.emoji ?? "";
export const dietEmoji = (key: string) => DIETS.find((d) => d.key === key)?.emoji ?? "";

/** Keeps only known categories, in canonical order, without duplicates. */
export function cleanCategories(values: readonly string[] | null | undefined): CategoryKey[] {
  const set = new Set(values ?? []);
  return CATEGORY_KEYS.filter((k) => set.has(k));
}

/** Keeps only known diet flags in canonical order; vegan implies vegetarian. */
export function cleanDiet(values: readonly string[] | null | undefined): DietKey[] {
  const set = new Set(values ?? []);
  if (set.has("vegan")) set.add("vegetarian");
  return DIET_KEYS.filter((k) => set.has(k));
}

/** Tags without blanks and case-insensitive duplicates (the first spelling wins). */
export function cleanTags(values: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values ?? []) {
    const tag = raw.trim().replace(/^#/, "");
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

// Same patterns as the database migration that replaced the free-text category
const CATEGORY_PATTERNS: [RegExp, CategoryKey | null, DietKey | null][] = [
  [/frühstück|breakfast|brunch|colazione/, "breakfast", null],
  [/vorspeise|snack|fingerfood|starter|appetizer|antipast|aperitivo/, "starters", null],
  [/salat|salad|insalat/, "salads", null],
  [/suppe|eintopf|soup|stew|zuppa|minestr/, "soups", null],
  [/hauptgericht|hauptspeise|main|secondo/, "mains", null],
  [/fleisch|meat|carne/, "mains", "meat"],
  [/fisch|fish|pesce/, "mains", "fish"],
  [/nudel|pasta|risotto|reis|rice|primo/, "pasta", null],
  [/beilage|side|contorn/, "sides", null],
  [/brot|bread|pane/, "bread", null],
  [/kuchen|torte|cake|torta|tarte/, "cakes", null],
  [/plätzchen|keks|gebäck|cookie|biscott|pasticc/, "cookies", null],
  [/dessert|nachtisch|nachspeise|süßspeise|dolc|pudding/, "desserts", null],
  [/sauce|soße|dip|marmelade|eingemacht|chutney|pesto|salsa/, "sauces", null],
  [/getränk|drink|cocktail|bevand|likör/, "drinks", null],
  [/vegetari/, null, "vegetarian"],
  [/vegan/, null, "vegan"],
];

/**
 * Maps free-text labels (e.g. a schema.org recipeCategory or keywords from a
 * web page) to fixed categories and diet flags. Labels that match nothing are
 * returned as tags so nothing gets lost.
 */
export function mapLabels(labels: readonly string[]): { categories: CategoryKey[]; diet: DietKey[]; tags: string[] } {
  const categories: string[] = [];
  const diet: string[] = [];
  const tags: string[] = [];
  for (const label of labels) {
    const text = label.trim().toLocaleLowerCase();
    if (!text) continue;
    let matched = false;
    for (const [pattern, category, flag] of CATEGORY_PATTERNS) {
      if (!pattern.test(text)) continue;
      matched = true;
      if (category) categories.push(category);
      if (flag) diet.push(flag);
    }
    if (!matched) tags.push(label.trim());
  }
  return { categories: cleanCategories(categories), diet: cleanDiet(diet), tags: cleanTags(tags) };
}
