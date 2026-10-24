import { describe, expect, it } from "vitest";
import { itemLabel, mergeAmounts, toShoppingEntry } from "./shopping";

describe("toShoppingEntry", () => {
  it("parses amount, unit and name", () => {
    expect(toShoppingEntry("200 g Mehl")).toMatchObject({ name: "Mehl", amount: 200, unit: "g" });
    expect(toShoppingEntry("3 Eier")).toMatchObject({ name: "Eier", amount: 3, unit: null });
    expect(toShoppingEntry("Salz")).toMatchObject({ name: "Salz", amount: null, unit: null });
    expect(toShoppingEntry("≈ 2 Eier")).toMatchObject({ name: "Eier", amount: 2 });
  });

  it("converts to base units so they can be added up", () => {
    expect(toShoppingEntry("0,2 kg Mehl")).toMatchObject({ amount: 200, unit: "g" });
    expect(toShoppingEntry("0,5 l Milch")).toMatchObject({ amount: 500, unit: "ml" });
  });

  it("gives the same key for the same ingredient", () => {
    expect(toShoppingEntry("300 g Mehl").merge_key).toBe(toShoppingEntry("0,2 kg Mehl").merge_key);
    expect(toShoppingEntry("1 Ei").merge_key).toBe(toShoppingEntry("3 Eier").merge_key);
    expect(toShoppingEntry("200 g Mehl").merge_key).not.toBe(toShoppingEntry("200 g Zucker").merge_key);
  });
});

describe("merge and label", () => {
  it("adds up and formats nicely", () => {
    const a = toShoppingEntry("300 g Mehl");
    const b = toShoppingEntry("0,2 kg Mehl");
    expect(itemLabel({ ...a, amount: mergeAmounts(a.amount, b.amount) })).toBe("500 g Mehl");
    expect(itemLabel({ name: "Mehl", amount: 1250, unit: "g" })).toBe("1,25 kg Mehl");
    expect(itemLabel({ name: "Eier", amount: 5, unit: null })).toBe("5 Eier");
    expect(itemLabel({ name: "Salz", amount: 0.5, unit: "tl" })).toBe("½ TL Salz");
    expect(itemLabel({ name: "Salz", amount: null, unit: null })).toBe("Salz");
    expect(itemLabel({ name: "flour", amount: 1500, unit: "g" }, "en")).toBe("1.5 kg flour");
  });
});
