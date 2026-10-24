import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { appName, t } from "@/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="glass mx-auto flex max-w-5xl items-center gap-2 rounded-2xl px-3 py-2 shadow-soft sm:gap-4 sm:px-4">
          <Link href="/" className="mr-auto flex items-center gap-2 font-serif text-lg font-semibold text-forest-900 sm:text-xl">
            <span className="flex size-8 items-center justify-center rounded-xl bg-forest-700 text-base text-cream shadow-soft">
              🌿
            </span>
            <span className="hidden truncate sm:inline">{appName}</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLinks />
            <form action={signOut}>
              <button className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-forest-800">
                {t.nav.signOut}
              </button>
            </form>
            <Link href="/recipes/new" className="btn-primary px-3 py-2 sm:px-4">
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">{t.nav.newRecipe}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
