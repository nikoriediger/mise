import { describe, expect, it } from "vitest";
import { cleanCategories, cleanDiet, cleanTags, mapLabels } from "./taxonomy";

describe("taxonomy", () => {
  it("keeps known categories in canonical order", () => {
    expect(cleanCategories(["desserts", "pizza", "breakfast", "desserts"])).toEqual(["breakfast", "desserts"]);
  });

  it("adds vegetarian to vegan recipes", () => {
    expect(cleanDiet(["vegan"])).toEqual(["vegetarian", "vegan"]);
    expect(cleanDiet(["keto", "fish"])).toEqual(["fish"]);
  });

  it("merges tags case-insensitively", () => {
    expect(cleanTags(["Weihnachten", " weihnachten ", "#Oma", "", "oma"])).toEqual(["Weihnachten", "Oma"]);
  });

  it("maps free-text labels and keeps the rest as tags", () => {
    expect(mapLabels(["Kuchen", "Vegetarisches Hauptgericht", "Gewürzmischung"])).toEqual({
      categories: ["mains", "cakes"],
      diet: ["vegetarian"],
      tags: ["Gewürzmischung"],
    });
    expect(mapLabels(["Main Course", "Vegan"])).toEqual({ categories: ["mains"], diet: ["vegetarian", "vegan"], tags: [] });
  });
});
