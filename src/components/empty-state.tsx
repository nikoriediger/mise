import Link from "next/link";
import { t } from "@/i18n";

export function EmptyState({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-mint-200 text-3xl shadow-soft">🥣</span>
      <p className="text-muted">{text}</p>
      {href && <Link href={href} className="btn-primary">{cta ?? t.recipes.emptyCta}</Link>}
    </div>
  );
}
