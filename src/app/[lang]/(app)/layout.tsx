import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { LanguageToggle } from "@/components/language-switcher";
import { BottomNav, NavLinks } from "@/components/nav-links";
import { appName } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <>
      <header className="sticky top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] print:hidden">
        <div className="glass mx-auto flex max-w-5xl items-center gap-2 rounded-2xl px-3 py-2 shadow-soft sm:gap-4 sm:px-4">
          <Link href="/" className="mr-auto flex min-w-0 items-center gap-2 font-serif text-lg font-semibold text-forest-900 sm:text-xl">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest-700 text-base text-cream shadow-soft">
              🌿
            </span>
            <span className="truncate">{appName}</span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            <NavLinks />
            <LanguageToggle />
            <form action={signOut}>
              <button className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-forest-800">
                {t.nav.signOut}
              </button>
            </form>
            <Link href="/recipes/new" className="btn-primary px-4 py-2">
              <span className="text-lg leading-none">+</span>
              <span>{t.nav.newRecipe}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 md:pb-10 md:pt-8 print:p-0">{children}</main>
      <BottomNav />
    </>
  );
}
