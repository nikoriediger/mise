"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { Dialog } from "@/components/dialog";
import { LanguageList } from "@/components/language-switcher";
import { spring } from "@/components/motion";
import { useI18n } from "@/i18n/client";
import { appName } from "@/i18n/config";

const links = [
  { href: "/", key: "recipes", icon: "🍽", match: (p: string) => p === "/" || (p.startsWith("/recipes/") && p !== "/recipes/new") },
  { href: "/cookbooks", key: "cookbooks", icon: "📚", match: (p: string) => p.startsWith("/cookbooks") },
  { href: "/family", key: "family", icon: "👨‍👩‍👧", match: (p: string) => p.startsWith("/family") },
] as const;

/** Reading the URL is request-time data, so the highlighted version streams in behind Suspense. */
function WithPathname({ children }: { children: (pathname: string | null) => React.ReactNode }) {
  return (
    <Suspense fallback={children(null)}>
      <PathnameReader>{children}</PathnameReader>
    </Suspense>
  );
}

function PathnameReader({ children }: { children: (pathname: string | null) => React.ReactNode }) {
  return children(usePathname());
}

/** Top navigation links (tablet/desktop). */
export function NavLinks() {
  return <WithPathname>{(pathname) => <DesktopLinks pathname={pathname} />}</WithPathname>;
}

function DesktopLinks({ pathname }: { pathname: string | null }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      {links.map((link) => {
        const active = pathname !== null && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative rounded-full px-3 py-1.5 text-sm transition-colors ${
              active ? "text-forest-900" : "text-muted hover:text-forest-800"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-sage-200/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]"
                transition={spring}
              />
            )}
            <span className="relative">{t.nav[link.key]}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Bottom tab bar for phones: Recipes · Cookbooks · ＋ · Family · More. */
export function BottomNav() {
  return <WithPathname>{(pathname) => <BottomTabs pathname={pathname} />}</WithPathname>;
}

function BottomTabs({ pathname }: { pathname: string | null }) {
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const tab = (link: (typeof links)[number]) => {
    const active = pathname !== null && link.match(pathname);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors ${
          active ? "text-forest-900" : "text-muted"
        }`}
      >
        {active && <motion.span layoutId="tab-pill" className="absolute inset-1 rounded-2xl bg-sage-200/70" transition={spring} />}
        <span className="relative text-xl leading-none" aria-hidden>{link.icon}</span>
        <span className="relative max-w-full truncate px-0.5">{t.nav[link.key]}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label={t.nav.menu}
        className="glass fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-1 rounded-3xl px-1.5 py-1 shadow-lifted md:hidden print:hidden"
      >
        {tab(links[0])}
        {tab(links[1])}
        <div className="flex flex-1 justify-center">
          <motion.div whileTap={{ scale: 0.9 }} transition={spring}>
            <Link
              href="/recipes/new"
              aria-label={t.nav.newRecipe}
              className="-mt-7 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-forest-700 to-moss-500 text-3xl leading-none text-cream shadow-glow ring-4 ring-sage-50"
            >
              +
            </Link>
          </motion.div>
        </div>
        {tab(links[2])}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium text-muted"
        >
          <span className="text-xl leading-none" aria-hidden>☰</span>
          <span>{t.nav.more}</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} className="px-5">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold text-forest-900">{t.lang.title}</h2>
            <LanguageList />
          </section>
          <form action={signOut}>
            <button className="btn-secondary min-h-12 w-full text-base">{t.nav.signOut}</button>
          </form>
          <p className="text-center text-xs text-muted">🌿 {appName}</p>
        </div>
      </Dialog>
    </>
  );
}
