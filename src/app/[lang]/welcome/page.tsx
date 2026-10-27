import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LanguageToggle } from "@/components/language-switcher";
import { appName, showLanding } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

const GITHUB_URL = "https://github.com/nikoriediger/mise";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: `${appName} – ${t.landing.metaTitle}` },
    description: t.landing.metaDescription,
    openGraph: { title: `${appName} – ${t.landing.metaTitle}`, description: t.landing.metaDescription, images: ["/icon-512.png"] },
  };
}

/** Public landing page for signed-out visitors (only when NEXT_PUBLIC_LANDING_PAGE=true). */
export default async function WelcomePage() {
  if (!showLanding) notFound();
  const { t } = await getI18n();
  const l = t.landing;

  return (
    <div className="page-in flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <span className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-forest-700 text-lg shadow-soft">🌿</span>
          <span className="font-serif text-2xl font-semibold text-forest-900">{appName}</span>
        </span>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link href="/login" className="btn-secondary">{t.auth.signIn}</Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="text-center lg:text-left">
            <p className="text-sm font-medium text-moss-600">{l.tagline}</p>
            <h1 className="mt-3 text-balance font-serif text-4xl font-semibold leading-tight text-forest-900 sm:text-5xl">{l.heroTitle}</h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted lg:mx-0">{l.heroText}</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/signup" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">{l.getStarted}</Link>
              <Link href="/login" className="btn-secondary w-full px-6 py-3 text-base sm:w-auto">{l.haveAccount}</Link>
            </div>
          </div>

          <RecipePreview
            title={l.previewTitle}
            meta={l.previewMeta}
            servingsLabel={l.previewServings}
            ingredients={l.previewIngredients}
            cookLabel={l.previewCook}
          />
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-center font-serif text-3xl font-semibold text-forest-900">{l.featuresTitle}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {l.features.map((feature) => (
              <div key={feature.title} className="glass flex gap-4 rounded-3xl p-5 shadow-soft sm:block">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-xl">{feature.icon}</span>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-forest-900 sm:mt-3">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Family + AI */}
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl bg-forest-800 p-6 text-cream shadow-lifted sm:p-8">
            <h2 className="font-serif text-3xl font-semibold">{l.familyTitle}</h2>
            <p className="mt-3 max-w-xl text-cream/85">{l.familyText}</p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {l.familyPoints.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-matcha-400 text-xs text-forest-900">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-dashed border-sage-300 bg-gradient-to-br from-cream to-mint-100/60 p-6 sm:p-8">
            <span className="rounded-full bg-gradient-to-r from-matcha-400 to-moss-500 px-2.5 py-0.5 text-xs font-semibold text-cream shadow-soft">
              {l.aiBadge}
            </span>
            <h2 className="mt-4 font-serif text-2xl font-semibold text-forest-900">✨ {l.aiTitle}</h2>
            <p className="mt-2 text-muted">{l.aiText}</p>
          </div>
        </section>

        {/* Final call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="glass flex flex-col items-center rounded-3xl px-6 py-10 text-center shadow-lifted">
            <h2 className="font-serif text-3xl font-semibold text-forest-900">{l.ctaTitle}</h2>
            <p className="mt-2 text-muted">{l.ctaText}</p>
            <Link href="/signup" className="btn-primary mt-6 px-6 py-3 text-base">{l.getStarted}</Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-muted sm:px-6">
        <span>🌿 {appName}</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
          {l.openSource}
        </a>
      </footer>
    </div>
  );
}

/** Static mock of a recipe card, so visitors see the app before signing up. */
function RecipePreview({ title, meta, servingsLabel, ingredients, cookLabel }: {
  title: string;
  meta: string;
  servingsLabel: string;
  ingredients: string[];
  cookLabel: string;
}) {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-4 -z-10 rotate-3 rounded-[2rem] bg-gradient-to-br from-matcha-300/60 to-mint-200/60" />
      <div className="glass overflow-hidden rounded-3xl shadow-lifted">
        <div className="flex h-36 items-center justify-center bg-gradient-to-br from-sage-200 to-matcha-300 text-6xl">🍎</div>
        <div className="p-5">
          <h3 className="font-serif text-2xl font-semibold text-forest-900">{title}</h3>
          <p className="mt-0.5 text-sm text-muted">{meta}</p>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-sage-50 px-3 py-2">
            <span className="text-sm font-medium text-forest-900">{servingsLabel}</span>
            <span className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full border border-line bg-cream text-forest-800">−</span>
              <span className="w-4 text-center font-semibold text-forest-900">8</span>
              <span className="flex size-7 items-center justify-center rounded-full bg-forest-700 text-cream">+</span>
            </span>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-forest-900">
            {ingredients.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-moss-500" />
                {item}
              </li>
            ))}
          </ul>
          <div className="btn-primary mt-5 w-full">👩‍🍳 {cookLabel}</div>
        </div>
      </div>
    </div>
  );
}
