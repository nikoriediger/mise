import { describe, expect, it } from "vitest";
import { parseIngredient, scaleIngredient } from "./scale-ingredients";

describe("parseIngredient", () => {
  it.each([
    ["200 g Mehl", 200, null, "g"],
    ["0,5 l Milch", 0.5, null, "l"],
    ["1.5 kg Kartoffeln", 1.5, null, "kg"],
    ["1/2 TL Salz", 0.5, null, "tl"],
    ["½ Zitrone", 0.5, null, null],
    ["1 ½ EL Zucker", 1.5, null, "el"],
    ["1½ EL Zucker", 1.5, null, "el"],
    ["1 1/2 Tassen Reis", 1.5, null, "tassen"],
    ["2-3 Zehen Knoblauch", 2, 3, "zehen"],
    ["2 – 3 Eier", 2, 3, null],
    ["3 Eier", 3, null, null],
    ["1 Pck. Vanillezucker", 1, null, "pck"],
    ["250g Butter", 250, null, "g"],
  ])("%s", (line, min, max, unit) => {
    expect(parseIngredient(line)).toMatchObject({ min, max, unit });
  });

  it.each(["Salz", "etwas Pfeffer", "Öl zum Braten", ""])("no quantity: %s", (line) => {
    expect(parseIngredient(line)).toBeNull();
  });
});

describe("scaleIngredient", () => {
  it.each([
    ["200 g Mehl", 1.5, "300 g Mehl"],
    ["200 g Mehl", 0.5, "100 g Mehl"],
    ["125 g Zucker", 1 / 3, "42 g Zucker"],
    ["800 g Kartoffeln", 2, "1,6 kg Kartoffeln"],
    ["600 ml Milch", 2, "1,2 l Milch"],
    ["0,5 l Milch", 2, "1 l Milch"],
    ["1/2 TL Salz", 2, "1 TL Salz"],
    ["1 EL Öl", 1.5, "1 ½ EL Öl"],
    ["1 EL Öl", 0.5, "½ EL Öl"],
    ["2 EL Öl", 1 / 3, "⅔ EL Öl"],
    ["3 Eier", 2, "6 Eier"],
    ["3 Eier", 0.5, "≈ 2 Eier"],
    ["1 Ei", 0.5, "≈ 1 Ei"],
    ["2-3 Zehen Knoblauch", 2, "4–6 Zehen Knoblauch"],
    ["1 Prise Salz", 2, "2 Prise Salz"],
    ["Salz", 2, "Salz"],
    ["250g Butter", 2, "500g Butter"],
  ])("%s × %d", (line, factor, expected) => {
    expect(scaleIngredient(line, factor, "de")).toBe(expected);
  });

  it("keeps the line untouched at factor 1", () => {
    expect(scaleIngredient("1,25 l Wasser", 1)).toBe("1,25 l Wasser");
  });

  it("uses a decimal point in English", () => {
    expect(scaleIngredient("800 g flour", 2, "en")).toBe("1.6 kg flour");
  });
});
