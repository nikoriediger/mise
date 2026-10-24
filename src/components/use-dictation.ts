"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API is not in TypeScript's DOM types yet
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

export type DictationError = "denied" | "failed";

/**
 * Speech-to-text with the browser's built-in recognition. Keeps listening
 * across pauses (the browser stops after a few seconds of silence, so it is
 * restarted until stop() is called) and reports each finished phrase.
 */
export function useDictation({ lang, onText }: { lang: string; onText: (text: string) => void }) {
  const supported = useSyncExternalStore(noop, () => recognitionClass() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<DictationError | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Rec = recognitionClass();
    if (!Rec) return;
    recognition.current?.abort();
    const rec = new Rec();
    rec.lang = lang;
    // Android's continuous mode repeats earlier phrases, so there every phrase is its own session
    rec.continuous = !/Android/i.test(navigator.userAgent);
    rec.interimResults = true;
    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) onTextRef.current(result[0].transcript);
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wanted.current = false;
      setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "failed");
    };
    rec.onend = () => {
      setInterim("");
      if (wanted.current && recognition.current === rec) {
        try {
          rec.start();
          return;
        } catch {}
      }
      if (recognition.current === rec) setListening(false);
    };
    recognition.current = rec;
    wanted.current = true;
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("failed");
    }
  }, [lang]);

  // Stop the microphone when the component goes away
  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop, toggle: listening ? stop : start };
}
