/**
 * Finds durations in recipe steps ("20 Minuten backen", "1,5 Std.", "20-25 min",
 * "10 minuti") so cook mode can offer a timer. Ranges start a timer for the
 * lower value (check early, cook longer if needed).
 */

const UNITS: [RegExp, number][] = [
  [/^(sekunden|sekunde|sek|seconds?|secs?|secondi|secondo|s)$/i, 1],
  [/^(minuten|minute|min|minutes?|mins?|minuti|minuto|m)$/i, 60],
  [/^(stunden|stunde|std|hours?|hrs?|h|ore|ora)$/i, 3600],
];

const PATTERN =
  /(\d+(?:[.,]\d+)?|½)(?:\s*(?:-|–|bis|to|a)\s*(\d+(?:[.,]\d+)?))?\s*(sekunden|sekunde|sek\.?|seconds?|secs?|secondi|secondo|minuten|minute|min\.?|minutes?|mins?|minuti|minuto|stunden|stunde|std\.?|hours?|hrs?|ore|ora|h)(?![a-zäöü])/gi;

export type FoundTimer = { label: string; seconds: number; index: number; length: number };

function toNumber(text: string) {
  return text === "½" ? 0.5 : Number(text.replace(",", "."));
}

export function findTimers(text: string): FoundTimer[] {
  const found: FoundTimer[] = [];
  for (const m of text.matchAll(PATTERN)) {
    const unit = m[3].replace(/\.$/, "");
    const factor = UNITS.find(([re]) => re.test(unit))?.[1];
    const value = toNumber(m[1]);
    if (!factor || !Number.isFinite(value) || value <= 0) continue;
    const seconds = Math.round(value * factor);
    if (seconds < 10 || seconds > 24 * 3600) continue;
    found.push({ label: m[0].trim(), seconds, index: m.index ?? 0, length: m[0].length });
  }
  return found;
}

/** 90 -> "1:30", 3720 -> "1:02:00" */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
