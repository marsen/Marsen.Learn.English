import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { isLocale, FALLBACK_LOCALE } from "@/domain/i18n/locale";
import { LocaleProvider } from "@/presentation/components/LocaleProvider";
import { loadAllMessages } from "@/infrastructure/i18n/messages";
import { TIME_ZONE } from "@/infrastructure/i18n/request";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marsen Learn English",
  robots: { index: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const current = await getLocale();
  const locale = isLocale(current) ? current : FALLBACK_LOCALE;
  return (
    <html lang={locale === "zh-TW" ? "zh-Hant" : locale}>
      <body className="flex min-h-screen flex-col">
        <LocaleProvider
          initialLocale={locale}
          messages={await loadAllMessages()}
          timeZone={TIME_ZONE}
        >
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
