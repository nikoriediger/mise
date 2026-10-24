import { describe, expect, it } from "vitest";
import { lineMatches, matchIngredients } from "./ingredient-search";

describe("lineMatches", () => {
  it.each([
    ["3 Eier", "Ei"],
    ["1 Ei", "Eier"],
    ["500 g Tomaten", "Tomate"],
    ["2 Zwiebeln", "zwiebel"],
    ["250 g Mascarpone", "mascarpone"],
    ["200 g Weizenmehl", "Mehl"],
    ["1 Prise Muskatnuss", "muskat"],
    ["2 große Äpfel", "äpfel"],
    ["2 large eggs", "egg"],
  ])("%s contains %s", (line, term) => {
    expect(lineMatches(line, term)).toBe(true);
  });

  it.each([
    ["200 g Reis", "Ei"],
    ["1 l Milch", "Mehl"],
    ["Salz", "Zucker"],
  ])("%s does not contain %s", (line, term) => {
    expect(lineMatches(line, term)).toBe(false);
  });
});

describe("matchIngredients", () => {
  it("splits matched and missing terms", () => {
    const tiramisu = ["250 g Mascarpone", "3 Eier", "200 g Löffelbiskuits", "Kakao"];
    expect(matchIngredients(tiramisu, ["Eier", "Mascarpone", "Kaffee"])).toEqual({
      matched: ["Eier", "Mascarpone"],
      missing: ["Kaffee"],
    });
  });
});
