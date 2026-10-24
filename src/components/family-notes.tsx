"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { addNote, deleteNote, updateNote } from "@/app/actions/notes";
import { ConfirmDialog } from "@/components/dialog";
import { spring } from "@/components/motion";
import type { RecipeNote } from "@/lib/data";
import { formatDate, t } from "@/i18n";

export function FamilyNotes({ recipeId, notes }: { recipeId: string; notes: RecipeNote[] }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-4 print:break-inside-avoid">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-forest-900">💬 {t.notes.title}</h2>
        <p className="mt-1 text-sm text-muted print:hidden">{t.notes.hint}</p>
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {notes.map((note) => (
            <motion.li
              key={note.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={spring}
            >
              <NoteCard note={note} recipeId={recipeId} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {notes.length === 0 && <p className="text-sm text-muted print:hidden">{t.notes.empty}</p>}

      <form
        className="glass rounded-2xl p-4 shadow-soft print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          startTransition(async () => {
            const result = await addNote(recipeId, draft);
            if (result?.error) setError(result.error);
            else {
              setDraft("");
              setError("");
            }
          });
        }}
      >
        <textarea
          className="input min-h-20 bg-white/70 [field-sizing:content]"
          value={draft}
          maxLength={2000}
          placeholder={t.notes.placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" disabled={pending || !draft.trim()}>
            {pending ? t.common.saving : t.notes.add}
          </button>
        </div>
      </form>
    </section>
  );
}

function NoteCard({ note, recipeId }: { note: RecipeNote; recipeId: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-sage-200 to-mint-200 text-xs font-semibold text-forest-800">
          {(note.author_name || "?").charAt(0).toUpperCase()}
        </span>
        <span className="font-medium text-forest-900">{note.author_name || "…"}</span>
        <span className="text-muted">
          · {formatDate(note.created_at)}
          {note.edited && ` · ${t.notes.edited}`}
        </span>
        <span className="ml-auto flex gap-1 print:hidden">
          {note.canEdit && !editing && (
            <button className="rounded-lg px-2 py-0.5 text-xs text-forest-800 hover:bg-sage-100" onClick={() => setEditing(true)}>
              {t.common.edit}
            </button>
          )}
          {note.canDelete && (
            <button className="rounded-lg px-2 py-0.5 text-xs text-red-700 hover:bg-red-50" onClick={() => setConfirm(true)}>
              {t.common.delete}
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea className="input min-h-20 [field-sizing:content]" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setText(note.body); setEditing(false); }}>{t.common.cancel}</button>
            <button
              className="btn-primary"
              disabled={pending || !text.trim()}
              onClick={() =>
                startTransition(async () => {
                  const result = await updateNote(note.id, recipeId, text);
                  if (!result?.error) setEditing(false);
                })
              }
            >
              {pending ? t.common.saving : t.common.save}
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line leading-relaxed">{note.body}</p>
      )}
      <ConfirmDialog
        open={confirm}
        message={t.notes.deleteConfirm}
        confirmLabel={t.common.delete}
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          startTransition(async () => {
            await deleteNote(note.id, recipeId);
            setConfirm(false);
          })
        }
      />
    </div>
  );
}
