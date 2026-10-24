"use client";

import { motion } from "framer-motion";
import { toBlob } from "html-to-image";
import { useRef, useState } from "react";
import { spring } from "@/components/motion";
import { useScale } from "@/components/recipe-scale";
import { appName, t } from "@/i18n";

export function PrintButton() {
  return (
    <motion.button className="btn-secondary print:hidden" onClick={() => window.print()} whileTap={{ scale: 0.96 }} transition={spring}>
      🖨 {t.view.print}
    </motion.button>
  );
}

type ShareProps = {
  coverUrl: string | null;
  facts: string[];
};

const MAX_INGREDIENTS = 8;

/** Renders a styled preview card to an image and shares it (or downloads it as a fallback). */
export function ShareButton({ coverUrl, facts }: ShareProps) {
  const { recipe, scaled, amount } = useScale();
  const cardRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [message, setMessage] = useState("");

  async function share() {
    setRendering(true);
    setMessage("");
    try {
      // Embed the photo as a data URL so it can be drawn into the image.
      const dataUrl = coverUrl ? await toDataUrl(coverUrl).catch(() => null) : null;
      setPhoto(dataUrl);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const blob = await toBlob(cardRef.current!, { pixelRatio: 1, width: 1080, height: 1350 });
      if (!blob) throw new Error("no image");
      const file = new File([blob], `${slug(recipe.title)}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: recipe.title }).catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") throw e;
        });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setMessage(t.view.downloaded);
      }
    } catch {
      setMessage(t.view.shareFailed);
    } finally {
      setRendering(false);
    }
  }

  const shown = scaled.slice(0, MAX_INGREDIENTS);
  const servingsFact = recipe.servings ? t.recipes.servingsCount(amount) : null;

  return (
    <div className="relative print:hidden">
      <motion.button className="btn-secondary" onClick={share} disabled={rendering} whileTap={{ scale: 0.96 }} transition={spring}>
        {rendering ? `⏳ ${t.view.sharing}` : `📤 ${t.view.share}`}
      </motion.button>
      {message && <p className="absolute left-0 top-full mt-1 w-64 text-xs text-muted">{message}</p>}

      {/* Off-screen card that gets captured (only rendered while sharing) */}
      {rendering && (
        <div aria-hidden className="pointer-events-none fixed -left-[2000px] top-0">
          <div
            ref={cardRef}
            style={{ width: 1080, height: 1350, fontFamily: "var(--font-geist-sans)" }}
            className="flex flex-col bg-gradient-to-br from-mint-100 via-sage-50 to-matcha-300/60 p-16 text-forest-900"
          >
            <div className="relative h-[560px] shrink-0 overflow-hidden rounded-[48px] bg-gradient-to-br from-sage-200 to-mint-200 shadow-lifted">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- captured by html-to-image
                <img src={photo} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center font-serif text-[220px] text-cream/80">{recipe.title.charAt(0)}</div>
              )}
            </div>
            <h2 className="mt-12 line-clamp-2 font-serif text-[76px] font-semibold leading-[1.05]" style={{ fontFamily: "var(--font-fraunces)" }}>
              {recipe.title}
            </h2>
            {[servingsFact, ...facts].filter(Boolean).length > 0 && (
              <p className="mt-5 text-[32px] text-moss-600">{[servingsFact, ...facts].filter(Boolean).join("  ·  ")}</p>
            )}
            <ul className="mt-8 grid grid-cols-2 gap-x-10 gap-y-3 text-[32px] leading-snug">
              {shown.map((item, i) => (
                <li key={i} className="flex gap-4">
                  <span className="mt-4 size-3 shrink-0 rounded-full bg-matcha-500" />
                  <span className="line-clamp-1">{item}</span>
                </li>
              ))}
            </ul>
            {scaled.length > MAX_INGREDIENTS && (
              <p className="mt-3 text-[28px] text-muted">{t.view.moreIngredients(scaled.length - MAX_INGREDIENTS)}</p>
            )}
            <p className="mt-auto flex items-center gap-4 text-[30px] font-medium text-forest-800">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-forest-700 text-[34px]">🌿</span>
              {t.view.sharedFrom(appName)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

async function toDataUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rezept";
}
