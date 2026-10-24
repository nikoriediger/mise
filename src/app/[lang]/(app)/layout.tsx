import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { LanguageToggle } from "@/components/language-switcher";
import { BottomNav, NavLinks } from "@/components/nav-links";
import { getMyProfile } from "@/lib/data";
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
          <nav className="hidden items-center gap-2 lg:flex">
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
          <Suspense fallback={<span className="size-10 shrink-0 rounded-full bg-sage-100" />}>
            <ProfileLink label={t.profile.open} />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 lg:pb-10 lg:pt-8 print:p-0">{children}</main>
      <Suspense fallback={<BottomNav />}>
        <BottomNavWithProfile />
      </Suspense>
    </>
  );
}

async function ProfileLink({ label }: { label: string }) {
  const profile = await getMyProfile();
  return (
    <Link href={`/people/${profile.user_id}`} aria-label={label} title={label} className="shrink-0 rounded-full ring-2 ring-cream transition-transform hover:scale-105">
      <Avatar url={profile.avatar_url} name={profile.display_name} size="md" />
    </Link>
  );
}

async function BottomNavWithProfile() {
  const profile = await getMyProfile();
  return <BottomNav profile={{ id: profile.user_id, name: profile.display_name, avatarUrl: profile.avatar_url }} />;
}
