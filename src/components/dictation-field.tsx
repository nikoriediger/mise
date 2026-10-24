"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { spring } from "@/components/motion";
import { useDictation } from "@/components/use-dictation";
import { SPEECH_LANGS, appendDictation } from "@/lib/dictation";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";

/**
 * Wraps a text field with a 🎙 button: what you say is typed into the field.
 * Uses the browser's speech recognition; the button is hidden where that
 * isn't available. Give the field some right padding (pr-12).
 */
export function DictationField({
  value,
  onChange,
  lang,
  mode = "text",
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Language spoken (defaults to the UI language). */
  lang?: Locale | null;
  /** "lines": every phrase on its own line (ingredients). */
  mode?: "text" | "lines";
  children: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  // Several phrases can arrive before React re-renders, so append to the latest text
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  const dictation = useDictation({
    lang: SPEECH_LANGS[lang ?? locale],
    onText: (text) => {
      current.current = appendDictation(current.current, text, mode);
      onChange(current.current);
    },
  });

  return (
    <div>
      <div className="relative">
        {children}
        {dictation.supported && (
          <MicButton listening={dictation.listening} onClick={dictation.toggle} label={dictation.listening ? t.dictation.stop : t.dictation.start} />
        )}
      </div>
      <DictationStatus listening={dictation.listening} interim={dictation.interim} error={dictation.error} />
    </div>
  );
}

export function MicButton({ listening, onClick, label, className = "absolute bottom-2 right-2" }: { listening: boolean; onClick: () => void; label: string; className?: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={listening}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className={`${className} flex size-10 items-center justify-center rounded-full text-lg shadow-soft transition-colors ${
        listening ? "bg-red-600 text-white" : "bg-sage-100 text-forest-800 hover:bg-sage-200"
      }`}
    >
      {listening && <motion.span aria-hidden className="absolute inset-0 rounded-full bg-red-500" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
      <span className="relative">{listening ? "■" : "🎙"}</span>
    </motion.button>
  );
}

export function DictationStatus({ listening, interim, error }: { listening: boolean; interim: string; error: string | null }) {
  const { t } = useI18n();
  return (
    <AnimatePresence initial={false}>
      {(listening || error) && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          aria-live="polite"
          className={`mt-1.5 overflow-hidden text-sm ${error ? "text-red-700" : "text-moss-600"}`}
        >
          {error ? (error === "denied" ? t.dictation.denied : t.dictation.failed) : interim ? <span className="italic">{interim}…</span> : `🎙 ${t.dictation.listening}`}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
