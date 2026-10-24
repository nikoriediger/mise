import { describe, expect, it } from "vitest";
import { appendDictation } from "./dictation";

describe("appendDictation", () => {
  it("starts an empty field with a capital letter", () => {
    expect(appendDictation("", "  den teig  kneten ")).toBe("Den teig kneten");
  });

  it("continues a sentence with a space", () => {
    expect(appendDictation("Den Teig", "gut kneten")).toBe("Den Teig gut kneten");
    expect(appendDictation("Den Teig kneten. ", "dann ruhen lassen")).toBe("Den Teig kneten. Dann ruhen lassen");
  });

  it("puts each dictation on its own line in line mode", () => {
    expect(appendDictation("200 g Mehl\n", "drei eier", "lines")).toBe("200 g Mehl\nDrei eier");
  });

  it("ignores empty results", () => {
    expect(appendDictation("Text", "   ")).toBe("Text");
  });
});
