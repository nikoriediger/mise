import { appName } from "@/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-forest-700 text-2xl shadow-lifted">🌿</span>
        <h1 className="font-serif text-4xl font-semibold text-forest-900">{appName}</h1>
      </div>
      <div className="glass w-full max-w-sm rounded-3xl p-7 shadow-lifted">{children}</div>
    </main>
  );
}
