"use client";

/* eslint-disable @next/next/no-img-element -- local previews and signed diary photos */
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, useTransition } from "react";
import { deleteCookLog, logCooking } from "@/app/actions/cooking";
import { Avatar } from "@/components/avatar";
import { ConfirmDialog, Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import type { CookLogEntry } from "@/lib/data";
import { compressImage, extensionFor } from "@/lib/image-compress";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET } from "@/lib/types";
import { useI18n } from "@/i18n/client";

function Stars({ value, onChange, size = "text-lg" }: { value: number | null; onChange?: (v: number | null) => void; size?: string }) {
  const { t, p } = useI18n();
  return (
    <span className={`inline-flex ${size}`} aria-label={value ? p(t.cookLog.stars, value) : undefined}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <motion.button
            key={n}
            type="button"
            whileTap={{ scale: 0.8 }}
            onClick={() => onChange(value === n ? null : n)}
            aria-label={p(t.cookLog.stars, n)}
            className="flex size-11 items-center justify-center"
          >
            <span className={value && n <= value ? "text-amber-500" : "text-sage-300"}>★</span>
          </motion.button>
        ) : (
          <span key={n} className={value && n <= value ? "text-amber-500" : "text-sage-300"}>★</span>
        ),
      )}
    </span>
  );
}

export function CookLog({ recipeId, familyId, entries }: { recipeId: string; familyId: string; entries: CookLogEntry[] }) {
  const { t, p, f, date } = useI18n();
  const [open, setOpen] = useState(false);
  const [cookedOn, setCookedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<{ file: Blob; url: string } | null>(null);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setRating(null);
    setComment("");
    setError("");
    setCookedOn(new Date().toISOString().slice(0, 10));
  }

  function save() {
    startTransition(async () => {
      let photoPath: string | null = null;
      if (photo) {
        const path = `${familyId}/${recipeId}/log-${crypto.randomUUID()}.${extensionFor(photo.file.type)}`;
        const { error: uploadError } = await createClient().storage.from(IMAGE_BUCKET).upload(path, photo.file, { contentType: photo.file.type });
        if (uploadError) {
          setError(t.common.error);
          return;
        }
        photoPath = path;
      }
      const result = await logCooking({ recipeId, cookedOn, rating, comment, photoPath });
      if (result.error) setError(result.error);
      else {
        reset();
        setOpen(false);
      }
    });
  }

  return (
    <section className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-forest-900">🍳 {t.cookLog.title}</h2>
          {entries.length > 0 && (
            <p className="text-sm text-muted">
              {p(t.cookLog.count, entries.length)} · {f(t.cookLog.lastCooked, { date: date(entries[0].cooked_on) })}
            </p>
          )}
        </div>
        <motion.button className="btn-primary min-h-12" whileTap={{ scale: 0.96 }} transition={spring} onClick={() => setOpen(true)}>
          ✓ {t.cookLog.cookedToday}
        </motion.button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">{t.cookLog.empty}</p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {entries.map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="card flex gap-3 p-4">
                <Avatar url={e.author_avatar} name={e.author_name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium text-forest-900">{e.author_name || "…"}</span>
                    <span className="text-muted">{date(e.cooked_on)}</span>
                    {e.rating && <Stars value={e.rating} size="text-sm" />}
                  </div>
                  {e.comment && <p className="mt-1 whitespace-pre-line leading-relaxed">{e.comment}</p>}
                  {e.photo_url && <img src={e.photo_url} alt="" className="mt-2 aspect-[4/3] w-full max-w-xs rounded-xl object-cover shadow-soft" />}
                </div>
                {e.canDelete && (
                  <button type="button" aria-label={t.common.delete} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm text-red-700 hover:bg-red-50" onClick={() => setToDelete(e.id)}>
                    ✕
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} className="px-5 sm:max-w-md">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.cookLog.dialogTitle}</h2>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="cooked-on">{t.cookLog.date}</label>
            <input id="cooked-on" type="date" className="input" value={cookedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setCookedOn(e.target.value)} />
          </div>
          <div>
            <span className="label">{t.cookLog.rating}</span>
            <Stars value={rating} onChange={setRating} size="text-3xl" />
          </div>
          <div>
            <label className="label" htmlFor="cook-comment">{t.cookLog.comment}</label>
            <textarea id="cook-comment" className="input min-h-20 [field-sizing:content]" maxLength={1000} value={comment} placeholder={t.cookLog.commentPlaceholder} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div>
            <span className="label">{t.cookLog.photo}</span>
            {photo ? (
              <div className="relative w-40">
                <img src={photo.url} alt="" className="aspect-[4/3] w-40 rounded-xl object-cover shadow-soft" />
                <button type="button" aria-label={t.common.delete} className="glass absolute right-1 top-1 flex size-9 items-center justify-center rounded-full text-sm" onClick={() => { URL.revokeObjectURL(photo.url); setPhoto(null); }}>
                  ✕
                </button>
              </div>
            ) : (
              <button type="button" className="btn-secondary min-h-12" onClick={() => fileRef.current?.click()}>📷 {t.cookLog.addPhoto}</button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const blob = await compressImage(file);
                setPhoto({ file: blob, url: URL.createObjectURL(blob) });
              }}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary min-h-12 w-full text-base" disabled={pending} onClick={save}>
            {pending ? t.common.saving : t.cookLog.save}
          </button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        message={t.cookLog.deleteConfirm}
        confirmLabel={t.common.delete}
        pending={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          startTransition(async () => {
            if (toDelete) await deleteCookLog(toDelete);
            setToDelete(null);
          })
        }
      />
    </section>
  );
}
