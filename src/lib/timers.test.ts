import { describe, expect, it } from "vitest";
import { findTimers, formatDuration } from "./timers";

describe("findTimers", () => {
  it.each([
    ["Bei 180 °C 40 Minuten backen.", 2400],
    ["20-25 Min. köcheln lassen", 1200],
    ["1,5 Std. im Ofen schmoren", 5400],
    ["Mindestens 4 Stunden kühlen", 14400],
    ["30 Sekunden pürieren", 30],
    ["Bake for 25 minutes", 1500],
    ["Simmer 1 hour", 3600],
    ["Cuocere per 10 minuti", 600],
    ["Riposare 2 ore", 7200],
    ["½ Stunde ruhen lassen", 1800],
  ])("%s", (text, seconds) => {
    expect(findTimers(text)[0]?.seconds).toBe(seconds);
  });

  it("finds several durations in one step", () => {
    expect(findTimers("10 Minuten anbraten, dann 1 Stunde schmoren").map((t) => t.seconds)).toEqual([600, 3600]);
  });

  it.each(["200 g Mehl", "180 °C vorheizen", "2 Eier", "Mehl sieben", "3 mm dick ausrollen"])("ignores: %s", (text) => {
    expect(findTimers(text)).toEqual([]);
  });
});

describe("formatDuration", () => {
  it.each([
    [90, "1:30"],
    [600, "10:00"],
    [3720, "1:02:00"],
    [0, "0:00"],
  ])("%d -> %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
