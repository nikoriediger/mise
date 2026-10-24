import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { appName, t } from "@/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="mr-auto font-serif text-xl font-semibold text-ink">
            {appName}
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3">
            <Link href="/cookbook" className="rounded-lg px-2 py-1 text-muted hover:text-ink">
              {t.nav.cookbook}
            </Link>
            <form action={signOut}>
              <button className="rounded-lg px-2 py-1 text-muted hover:text-ink">{t.nav.signOut}</button>
            </form>
            <Link href="/recipes/new" className="btn-primary">
              + <span className="hidden sm:inline">{t.nav.newRecipe}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
