import { appName } from "@/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <h1 className="mb-8 font-serif text-4xl font-semibold text-ink">{appName}</h1>
      <div className="card w-full max-w-sm p-6 shadow-sm">{children}</div>
    </main>
  );
}
