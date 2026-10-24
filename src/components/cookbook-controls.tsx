"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { createCookbook, deleteCookbook, updateCookbook, type CookbookFormState } from "@/app/actions/cookbooks";
import { ConfirmDialog, Dialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import { COOKBOOK_EMOJIS, type Cookbook } from "@/lib/types";
import { t } from "@/i18n";

const grid: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export function CookbookGrid({ cookbooks, showOwner }: { cookbooks: Cookbook[]; showOwner?: boolean }) {
  return (
    <motion.ul variants={grid} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cookbooks.map((b) => (
        <motion.li key={b.id} variants={item}>
          <motion.div
            className="rounded-2xl"
            whileHover={{ y: -5, boxShadow: "var(--shadow-lifted)" }}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <Link href={`/cookbooks/${b.id}`} className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-cream p-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-mint-200 text-3xl transition-transform duration-500 ease-spring group-hover:rotate-[-6deg] group-hover:scale-110">
                {b.emoji}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-serif text-lg font-semibold text-forest-900">{b.name}</span>
                <span className="block text-sm text-muted">
                  {[showOwner && b.owner_name && t.recipes.byOwner(b.owner_name), t.recipes.count(b.recipe_count)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
          </motion.div>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function CookbookFields({ cookbook, state, pending }: { cookbook?: Cookbook; state: CookbookFormState; pending: boolean }) {
  const [emoji, setEmoji] = useState(cookbook?.emoji ?? COOKBOOK_EMOJIS[0]);
  return (
    <div className="space-y-4">
      {cookbook && <input type="hidden" name="id" value={cookbook.id} />}
      <input type="hidden" name="emoji" value={emoji} />
      <div>
        <label className="label" htmlFor="cookbook-name">{t.cookbooks.name}</label>
        <input id="cookbook-name" name="name" className="input" defaultValue={cookbook?.name} placeholder={t.cookbooks.namePlaceholder} required autoFocus />
      </div>
      <div>
        <span className="label">{t.cookbooks.emoji}</span>
        <div className="flex flex-wrap gap-1.5">
          {COOKBOOK_EMOJIS.map((e) => (
            <motion.button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              className={`flex size-10 items-center justify-center rounded-xl text-xl transition-colors ${
                emoji === e ? "bg-sage-200 ring-2 ring-forest-700" : "bg-cream hover:bg-sage-100"
              }`}
            >
              {e}
            </motion.button>
          ))}
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? t.common.saving : t.common.save}</button>
    </div>
  );
}

export function CreateCookbookButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCookbook, undefined);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ {t.cookbooks.create}</button>
      <Dialog open={open} onClose={() => setOpen(false)} className="w-full max-w-md p-6">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.cookbooks.createTitle}</h2>
        <form action={action}>
          <CookbookFields state={state} pending={pending} />
        </form>
      </Dialog>
    </>
  );
}

export function EditCookbookButton({ cookbook }: { cookbook: Cookbook }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, startDelete] = useTransition();
  const [state, action, pending] = useActionState(async (prev: CookbookFormState, formData: FormData) => {
    const result = await updateCookbook(prev, formData);
    if (!result?.error) setOpen(false);
    return result;
  }, undefined);

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>{t.cookbooks.settings}</button>
      <Dialog open={open} onClose={() => setOpen(false)} className="w-full max-w-md p-6">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-forest-900">{t.cookbooks.settings}</h2>
        <form action={action}>
          <CookbookFields cookbook={cookbook} state={state} pending={pending} />
        </form>
        <div className="mt-4 border-t border-line pt-4">
          <button className="btn-danger w-full" onClick={() => setConfirmDelete(true)}>{t.common.delete}</button>
          {deleteError && <p className="mt-2 text-sm text-red-700">{deleteError}</p>}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        message={t.cookbooks.deleteConfirm}
        confirmLabel={t.common.delete}
        pending={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          startDelete(async () => {
            const result = await deleteCookbook(cookbook.id);
            setConfirmDelete(false);
            if (result?.error) setDeleteError(result.error);
          })
        }
      />
    </>
  );
}
