import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { MotionProvider } from "@/components/motion";
import { OfflineBanner, ServiceWorkerRegister } from "@/components/pwa";
import { I18nProvider } from "@/i18n/client";
import { appName, locales } from "@/i18n/config";
import { getMessages } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef6ea",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <MotionProvider>
            {children}
            <OfflineBanner />
          </MotionProvider>
          <ServiceWorkerRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
