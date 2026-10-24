"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { spring } from "@/components/motion";
import { CATEGORIES, DIETS, cleanDiet, cleanTags, type CategoryKey, type DietKey } from "@/lib/taxonomy";
import { useI18n } from "@/i18n/client";

const chip = (on: boolean) =>
  `min-h-10 rounded-full px-3.5 text-sm transition-colors ${
    on ? "bg-forest-700 text-cream shadow-soft" : "bg-sage-50 text-forest-800 ring-1 ring-line hover:bg-sage-100"
  }`;

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

export function CategoryPicker({ value, onChange }: { value: CategoryKey[]; onChange: (v: CategoryKey[]) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <span className="label">
        {t.form.categories} <span className="font-normal normal-case tracking-normal text-muted">· {t.form.categoriesHint}</span>
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map((c) => {
          const on = value.includes(c.key);
          return (
            <motion.button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggle(value, c.key))}
              whileTap={{ scale: 0.96 }}
              transition={spring}
              className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-left text-sm leading-tight transition-colors ${
                on ? "bg-forest-700 text-cream shadow-soft" : "bg-sage-50 text-forest-800 ring-1 ring-line hover:bg-sage-100"
              }`}
            >
              <span className="text-lg" aria-hidden>{c.emoji}</span>
              {t.categories[c.key]}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function DietPicker({ value, onChange }: { value: DietKey[]; onChange: (v: DietKey[]) => void }) {
  const { t } = useI18n();
  function flip(key: DietKey) {
    const next = toggle(value, key);
    // Vegan implies vegetarian; unticking vegetarian also unticks vegan
    if (key === "vegetarian" && !next.includes("vegetarian")) onChange(next.filter((k) => k !== "vegan"));
    else onChange(cleanDiet(next));
  }
  return (
    <div>
      <span className="label">{t.form.diet}</span>
      <div className="flex flex-wrap gap-2">
        {DIETS.map((d) => {
          const on = value.includes(d.key);
          return (
            <motion.button key={d.key} type="button" role="checkbox" aria-checked={on} onClick={() => flip(d.key)} whileTap={{ scale: 0.95 }} transition={spring} className={chip(on)}>
              {on ? "✓ " : ""}{d.emoji} {t.diet[d.key]}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const { t, f } = useI18n();
  const [text, setText] = useState("");
  const has = (tag: string) => value.some((v) => v.toLocaleLowerCase() === tag.toLocaleLowerCase());

  function add(raw: string) {
    // Reuse the family's spelling of a known tag
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const known = parts.map((p) => suggestions.find((s) => s.toLocaleLowerCase() === p.toLocaleLowerCase()) ?? p);
    onChange(cleanTags([...value, ...known]));
    setText("");
  }

  const q = text.trim().toLocaleLowerCase();
  const open = suggestions.filter((s) => !has(s) && (!q || s.toLocaleLowerCase().includes(q))).slice(0, q ? 8 : 12);

  return (
    <div>
      <label className="label" htmlFor="tag-input">{t.form.tags}</label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {value.map((tag) => (
              <motion.li key={tag.toLocaleLowerCase()} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={spring}>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== tag))}
                  aria-label={f(t.form.removeTag, { tag })}
                  className="flex min-h-9 items-center gap-1.5 rounded-full bg-mint-100 px-3 text-sm text-forest-800 ring-1 ring-matcha-300 hover:bg-red-50 hover:ring-red-200"
                >
                  #{tag} <span aria-hidden className="text-muted">✕</span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id="tag-input"
          className="input"
          value={text}
          enterKeyHint="done"
          placeholder={t.form.tagPlaceholder}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
        <button type="button" className="btn-secondary shrink-0" disabled={!text.trim()} onClick={() => add(text)}>
          {t.form.addTag}
        </button>
      </div>
      {open.length > 0 && (
        <div className="mt-2">
          <p className="hint mb-1">{t.form.tagSuggestions}</p>
          <div className="flex flex-wrap gap-1.5">
            {open.map((s) => (
              <button
                key={s}
                type="button"
                // Keep focus in the input so onBlur doesn't add the half-typed text first
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
                className="min-h-9 rounded-full bg-sage-50 px-3 text-sm text-forest-800 ring-1 ring-line hover:bg-sage-100"
              >
                + #{s}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="hint">{t.form.tagsHint}</p>
    </div>
  );
}
