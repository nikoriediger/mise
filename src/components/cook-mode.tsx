"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { StepTimers, TimerProvider } from "@/components/cook-timers";
import { spring } from "@/components/motion";
import { ServingsStepper, useScale } from "@/components/recipe-scale";
import { useI18n } from "@/i18n/client";

type Progress = { ingredients: number[]; steps: number[] };
const empty: Progress = { ingredients: [], steps: [] };
const noopSubscribe = () => () => {};

/** Keeps the screen awake while active; re-acquires the lock when the page becomes visible again. */
function useWakeLock(active: boolean) {
  const [state, setState] = useState<"on" | "unsupported" | "off">("off");

  useEffect(() => {
    if (!active) return;
    if (!("wakeLock" in navigator)) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) await lock.release();
        else setState("on");
        lock.addEventListener("release", () => !cancelled && setState("off"));
      } catch {
        setState("unsupported");
      }
    };
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
      setState("off");
    };
  }, [active]);

  return state;
}

export function CookModeButton({ recipeId }: { recipeId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <>
      <motion.button
        className="btn-primary min-h-12 flex-1 sm:flex-none print:hidden"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={spring}
      >
        👩‍🍳 {t.view.cookMode}
      </motion.button>
      {mounted && createPortal(<AnimatePresence>{open && <CookMode recipeId={recipeId} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function CookMode({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const { t, f } = useI18n();
  const { recipe, scaled } = useScale();
  const storageKey = `cook-progress:${recipeId}`;
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      return { ...empty, ...JSON.parse(localStorage.getItem(storageKey) ?? "{}") };
    } catch {
      return empty;
    }
  });
  const wakeLock = useWakeLock(true);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [progress, storageKey]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggle = useCallback((list: keyof Progress, i: number) => {
    setProgress((p) => ({ ...p, [list]: p[list].includes(i) ? p[list].filter((x) => x !== i) : [...p[list], i] }));
  }, []);

  const currentStep = recipe.steps.findIndex((_, i) => !progress.steps.includes(i));
  const allDone = recipe.steps.length > 0 && currentStep === -1;

  return (
    <TimerProvider title={recipe.title}>
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-sage-50"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="glass sticky top-0 z-10 border-b border-white/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto min-w-0">
            <h2 className="truncate font-serif text-xl font-semibold text-forest-900 sm:text-2xl">{recipe.title}</h2>
            <p className="text-xs text-muted">
              {wakeLock === "on" ? `🔆 ${t.view.screenOn}` : wakeLock === "unsupported" ? t.view.screenOnUnsupported : ""}
              {recipe.steps.length > 0 && ` · ${f(t.view.progress, { done: progress.steps.length, total: recipe.steps.length })}`}
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setProgress(empty)}>↺ {t.view.reset}</button>
          <button className="btn-primary" onClick={onClose}>{t.view.exitCookMode}</button>
        </div>
        {recipe.steps.length > 0 && (
          <div className="h-1 bg-sage-200">
            <motion.div
              className="h-full bg-gradient-to-r from-matcha-500 to-forest-700"
              animate={{ width: `${(progress.steps.length / recipe.steps.length) * 100}%` }}
              transition={spring}
            />
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 text-lg lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {scaled.length > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-serif text-2xl font-semibold text-forest-900">{t.recipes.ingredients}</h3>
              <ServingsStepper large />
            </div>
            <ul className="space-y-2">
              {scaled.map((item, i) => (
                <CheckItem key={i} done={progress.ingredients.includes(i)} onToggle={() => toggle("ingredients", i)}>
                  {item}
                </CheckItem>
              ))}
            </ul>
          </section>
        )}
        {recipe.steps.length > 0 && (
          <section>
            <h3 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.recipes.steps}</h3>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => (
                <CheckItem
                  key={i}
                  done={progress.steps.includes(i)}
                  current={i === currentStep}
                  number={i + 1}
                  onToggle={() => toggle("steps", i)}
                  extra={<StepTimers text={step} />}
                >
                  {step}
                </CheckItem>
              ))}
            </ol>
            <AnimatePresence>
              {allDone && (
                <motion.p
                  className="mt-6 rounded-2xl bg-mint-100 p-5 text-center font-serif text-2xl text-forest-900 shadow-soft"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                >
                  {t.view.allDone}
                </motion.p>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
      <p className="pb-40 text-center text-xs text-muted">{t.view.tapToCheck}</p>
    </motion.div>
    </TimerProvider>
  );
}

function CheckItem(props: { done: boolean; current?: boolean; number?: number; onToggle: () => void; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <li>
      <motion.button
        type="button"
        layout
        onClick={props.onToggle}
        whileTap={{ scale: 0.98 }}
        transition={spring}
        className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors ${
          props.current
            ? "border-matcha-400 bg-cream shadow-glow"
            : props.done
              ? "border-transparent bg-sage-100/60"
              : "border-white/70 bg-cream shadow-soft"
        }`}
      >
        <motion.span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${
            props.done ? "bg-matcha-500 text-cream" : "bg-sage-100 text-forest-800"
          }`}
          animate={{ scale: props.done ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          {props.done ? "✓" : (props.number ?? "")}
        </motion.span>
        <span
          className={`pt-1 leading-relaxed decoration-2 transition-colors duration-300 ${
            props.done ? "text-muted line-through decoration-forest-800/40" : "text-forest-900"
          }`}
        >
          {props.children}
        </span>
      </motion.button>
      {props.extra}
    </li>
  );
}
