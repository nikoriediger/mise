"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import { t } from "@/i18n";

type GalleryImage = { id: string; url: string };

export function ImageGallery({ images, variant = "photos" }: { images: GalleryImage[]; variant?: "photos" | "scans" }) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (index === null || images.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, images.length, step]);

  const large = variant === "photos";

  return (
    <>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 pt-1">
        {images.map((img, i) => (
          <motion.button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            whileHover={{ y: -4, scale: 1.02, boxShadow: "var(--shadow-lifted)" }}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            style={{ boxShadow: "var(--shadow-soft)" }}
            className={`relative shrink-0 snap-start overflow-hidden rounded-2xl border border-white/70 bg-sage-100 ${
              large ? "aspect-[4/3] w-[80vw] max-w-md" : "aspect-[3/4] w-36 sm:w-44"
            }`}
          >
            <Image src={img.url} alt="" fill unoptimized className="object-cover" />
          </motion.button>
        ))}
      </div>

      <Dialog open={index !== null} onClose={close} className="relative w-full max-w-4xl p-2 sm:p-3">
        {index !== null && (
          <>
            <div className="relative h-[75vh] overflow-hidden rounded-2xl bg-forest-900/10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={images[index].id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Image src={images[index].url} alt="" fill unoptimized className="object-contain" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <span className="text-sm text-muted">
                {index + 1} / {images.length}
              </span>
              <div className="flex gap-2">
                {images.length > 1 && (
                  <>
                    <button className="btn-secondary px-3" onClick={() => step(-1)} aria-label={t.common.previous}>←</button>
                    <button className="btn-secondary px-3" onClick={() => step(1)} aria-label={t.common.next}>→</button>
                  </>
                )}
                <button className="btn-primary" onClick={close}>{t.common.close}</button>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
