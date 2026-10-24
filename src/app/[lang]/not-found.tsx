import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-mint-200 text-3xl shadow-soft">🍳</span>
      <h1 className="font-serif text-3xl font-semibold text-forest-900">{t.notFound.title}</h1>
      <p className="max-w-sm text-muted">{t.notFound.text}</p>
      <Link href="/" className="btn-primary min-h-12">{t.notFound.back}</Link>
    </main>
  );
}
