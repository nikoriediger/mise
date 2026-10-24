"use client";

import { MotionConfig, motion } from "framer-motion";

export const spring = { type: "spring", stiffness: 400, damping: 28 } as const;

/** Respects the user's "reduce motion" setting for every animation inside. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades and slides each page in on navigation (used in template.tsx files). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
