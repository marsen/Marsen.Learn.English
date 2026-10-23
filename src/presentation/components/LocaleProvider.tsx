"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/domain/i18n/locale";

const ONE_YEAR = 60 * 60 * 24 * 365;

const SetLocaleContext = createContext<(locale: string) => void>(() => {});

/** 切換介面語言（在瀏覽器直接換，不用重新整理） */
export const useSetLocale = () => useContext(SetLocaleContext);

/**
 * 介面語言放在瀏覽器：第一次的語言由伺服器決定（cookie → 瀏覽器語言），所以不會閃；
 * 之後切換只在瀏覽器換翻譯、寫 cookie，不回伺服器重新產生頁面。
 * 所以有翻譯文字的元件都要是瀏覽器端元件（"use client"），見 CLAUDE.md「多語系」。
 */
export function LocaleProvider({
  initialLocale,
  messages,
  timeZone,
  children,
}: {
  initialLocale: Locale;
  /** 所有語言的翻譯檔，切換時不用再下載 */
  messages: Record<Locale, AbstractIntlMessages>;
  timeZone: string;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "zh-TW" ? "zh-Hant" : locale;
  }, [locale]);

  const change = (next: string) => {
    if (!isLocale(next)) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    setLocale(next);
  };

  return (
    <SetLocaleContext.Provider value={change}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages[locale]}
        timeZone={timeZone}
      >
        {children}
      </NextIntlClientProvider>
    </SetLocaleContext.Provider>
  );
}
