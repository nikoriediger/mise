"use client";

import { MotionConfig } from "framer-motion";

export const spring = { type: "spring", stiffness: 400, damping: 28 } as const;

/** Respects the user's "reduce motion" setting for every animation inside. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
