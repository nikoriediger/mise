import { LanguageToggle } from "@/components/language-switcher";
import { appName } from "@/i18n/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-20">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]">
        <LanguageToggle />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-forest-700 text-2xl shadow-lifted">🌿</span>
        <h1 className="max-w-full text-balance font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{appName}</h1>
      </div>
      <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-lifted sm:p-7">{children}</div>
    </main>
  );
}
