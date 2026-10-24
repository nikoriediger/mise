"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { addShoppingLines, clearChecked, deleteItem, setItemChecked, type ListKind } from "@/app/actions/shopping";
import { spring } from "@/components/motion";
import type { ShoppingItem } from "@/lib/data";
import { itemLabel } from "@/lib/shopping";
import { useI18n } from "@/i18n/client";

type Change = { type: "check"; id: string; checked: boolean } | { type: "delete"; id: string } | { type: "clear"; list: ListKind };

export function ShoppingList({ items }: { items: ShoppingItem[] }) {
  const { t, f, locale } = useI18n();
  const router = useRouter();
  const [list, setList] = useState<ListKind>("mine");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [, startTransition] = useTransition();
  const [shown, apply] = useOptimistic(items, (state: ShoppingItem[], change: Change) => {
    if (change.type === "check") return state.map((i) => (i.id === change.id ? { ...i, checked: change.checked } : i));
    if (change.type === "delete") return state.filter((i) => i.id !== change.id);
    return state.filter((i) => !(i.list === change.list && i.checked));
  });

  // The family list can change on other phones: refresh when coming back to the app
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const current = shown.filter((i) => i.list === list);
  const open = current.filter((i) => !i.checked);
  const done = current.filter((i) => i.checked);

  function share() {
    const lines = open.map((i) => `• ${itemLabel(i, locale)}`).join("\n");
    const content = `${t.shopping.title}\n${lines}`;
    if (navigator.share) navigator.share({ title: t.shopping.title, text: content }).catch(() => {});
    else {
      navigator.clipboard.writeText(content);
      setNotice(t.shopping.copied);
      setTimeout(() => setNotice(""), 2500);
    }
  }

  const row = (item: ShoppingItem) => (
    <motion.li
      key={item.id}
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
      transition={spring}
      className="flex items-center gap-2"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={() =>
          startTransition(async () => {
            apply({ type: "check", id: item.id, checked: !item.checked });
            await setItemChecked(item.id, !item.checked);
          })
        }
        className={`flex min-h-14 flex-1 items-center gap-3 rounded-2xl border px-4 py-2 text-left transition-colors ${
          item.checked ? "border-transparent bg-sage-100/60" : "border-white/70 bg-cream shadow-soft"
        }`}
      >
        <motion.span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm ${item.checked ? "border-matcha-500 bg-matcha-500 text-cream" : "border-sage-300"}`}
          animate={{ scale: item.checked ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.25 }}
        >
          {item.checked && "✓"}
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className={`block ${item.checked ? "text-muted line-through" : "text-forest-900"}`}>{itemLabel(item, locale)}</span>
          {item.sources.length > 0 && <span className="block truncate text-xs text-muted">{f(t.shopping.from, { titles: item.sources.join(", ") })}</span>}
        </span>
      </button>
      <button
        type="button"
        aria-label={t.shopping.remove}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm text-muted hover:bg-red-50 hover:text-red-700"
        onClick={() =>
          startTransition(async () => {
            apply({ type: "delete", id: item.id });
            await deleteItem(item.id);
          })
        }
      >
        ✕
      </button>
    </motion.li>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">🛒 {t.shopping.title}</h1>
        {open.length > 0 && (
          <button type="button" className="btn-secondary min-h-11" onClick={share}>📤 {t.shopping.share}</button>
        )}
      </div>
      {notice && <p className="text-sm text-moss-600">{notice}</p>}

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-sage-100/80 p-1">
        {(["mine", "family"] as const).map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={list === kind}
            onClick={() => setList(kind)}
            className={`relative min-h-11 rounded-xl text-sm font-medium transition-colors ${list === kind ? "text-forest-900" : "text-muted"}`}
          >
            {list === kind && <motion.span layoutId="list-tab" className="absolute inset-0 rounded-xl bg-cream shadow-soft" transition={spring} />}
            <span className="relative">
              {kind === "mine" ? t.shopping.mine : t.shopping.family}
              <span className="ml-1.5 text-xs text-muted">{shown.filter((i) => i.list === kind && !i.checked).length}</span>
            </span>
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          setText("");
          startTransition(async () => {
            await addShoppingLines(value.split(/[,\n]/), list);
          });
        }}
      >
        <input className="input" value={text} placeholder={t.shopping.addPlaceholder} onChange={(e) => setText(e.target.value)} enterKeyHint="done" />
        <button className="btn-primary min-h-12 shrink-0" disabled={!text.trim()}>{t.shopping.add}</button>
      </form>

      {open.length === 0 && done.length === 0 ? (
        <p className="py-10 text-center text-muted">{t.shopping.empty}</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>{open.map(row)}</AnimatePresence>
        </ul>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.shopping.done} · {done.length}</h2>
            <button
              type="button"
              className="min-h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50"
              onClick={() =>
                startTransition(async () => {
                  apply({ type: "clear", list });
                  await clearChecked(list);
                })
              }
            >
              {t.shopping.clearDone}
            </button>
          </div>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>{done.map(row)}</AnimatePresence>
          </ul>
        </section>
      )}
    </div>
  );
}
