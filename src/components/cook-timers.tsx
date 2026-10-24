"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { spring } from "@/components/motion";
import { useI18n } from "@/i18n/client";
import { findTimers, formatDuration } from "@/lib/timers";

type Timer = {
  id: string;
  label: string;
  total: number;
  /** Timestamp when it rings; null while paused. */
  endsAt: number | null;
  /** Seconds left when paused. */
  left: number;
  done: boolean;
};

type TimerApi = { timers: Timer[]; start: (label: string, seconds: number) => void };
const TimerContext = createContext<TimerApi | null>(null);

/** Short three-tone chime with the Web Audio API (no sound file needed). */
function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = [880, 1046, 1318][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.32);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

export function TimerProvider({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const rung = useRef(new Set<string>());

  const start = useCallback((label: string, seconds: number) => {
    setTimers((list) => [...list, { id: crypto.randomUUID(), label, total: seconds, endsAt: Date.now() + seconds * 1000, left: seconds, done: false }]);
    // Ask for notification permission on the first timer (so a finished timer can notify)
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  }, []);

  // Tick (timestamps keep it accurate even if the page was in the background)
  useEffect(() => {
    if (!timers.some((x) => x.endsAt && !x.done)) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timers]);

  // Ring finished timers once
  useEffect(() => {
    const finished = timers.filter((x) => x.endsAt && !x.done && x.endsAt <= now && !rung.current.has(x.id));
    if (!finished.length) return;
    for (const x of finished) rung.current.add(x.id);
    queueMicrotask(() => setTimers((list) => list.map((x) => (finished.some((d) => d.id === x.id) ? { ...x, done: true, endsAt: null, left: 0 } : x))));
    chime();
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker?.ready
        .then((reg) => reg.showNotification(t.push.timerTitle, { body: `${title} · ${finished.map((x) => x.label).join(", ")}`, icon: "/icon-192.png", tag: "timer" }))
        .catch(() => {});
    }
  }, [now, timers, t, title]);

  const update = (id: string, fn: (x: Timer) => Timer | null) =>
    setTimers((list) => list.flatMap((x) => (x.id === id ? (fn(x) ?? []) : [x])));

  return (
    <TimerContext value={{ timers, start }}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md flex-col gap-2">
        <AnimatePresence>
          {timers.map((x) => {
            const left = x.done ? 0 : x.endsAt ? (x.endsAt - now) / 1000 : x.left;
            const progress = x.done ? 1 : 1 - left / x.total;
            return (
              <motion.div
                key={x.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={x.done ? { opacity: 1, y: 0, scale: [1, 1.04, 1] } : { opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                transition={x.done ? { scale: { repeat: Infinity, duration: 1 } } : spring}
                className={`pointer-events-auto relative overflow-hidden rounded-2xl px-4 py-3 shadow-lifted ${x.done ? "bg-forest-700 text-cream" : "glass text-forest-900"}`}
              >
                {!x.done && <motion.div className="absolute inset-y-0 left-0 bg-matcha-300/40" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5 }} />}
                <div className="relative flex items-center gap-3">
                  <span className="text-xl" aria-hidden>⏱</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-2xl font-semibold tabular-nums">{x.done ? t.timer.done : formatDuration(left)}</span>
                    <span className={`block truncate text-xs ${x.done ? "text-cream/80" : "text-muted"}`}>{x.label}</span>
                  </span>
                  {!x.done && (
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-full bg-cream/80 text-lg"
                      aria-label={x.endsAt ? t.timer.pause : t.timer.resume}
                      onClick={() =>
                        update(x.id, (y) => (y.endsAt ? { ...y, endsAt: null, left: (y.endsAt - Date.now()) / 1000 } : { ...y, endsAt: Date.now() + y.left * 1000 }))
                      }
                    >
                      {x.endsAt ? "⏸" : "▶"}
                    </button>
                  )}
                  <button type="button" className="flex size-11 items-center justify-center rounded-full bg-cream/80 text-lg text-forest-900" aria-label={t.timer.cancel} onClick={() => update(x.id, () => null)}>
                    ✕
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </TimerContext>
  );
}

/** Timer buttons for the durations found in a step. */
export function StepTimers({ text }: { text: string }) {
  const { t, f } = useI18n();
  const api = use(TimerContext);
  const found = findTimers(text);
  if (!api || !found.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-[3.25rem]">
      {found.map((timer) => {
        const running = api.timers.some((x) => x.label === timer.label && !x.done);
        return (
          <motion.button
            key={timer.index}
            type="button"
            whileTap={{ scale: 0.93 }}
            transition={spring}
            aria-label={f(t.timer.start, { label: timer.label })}
            onClick={() => api.start(timer.label, timer.seconds)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-soft ${running ? "bg-matcha-300 text-forest-900" : "bg-forest-700 text-cream"}`}
          >
            ⏱ {timer.label}
            {running && <span className="text-xs opacity-80">· {t.timer.running}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
