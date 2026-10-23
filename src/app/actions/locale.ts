"use server";

import { cookies } from "next/headers";
import { isLocale } from "@/domain/i18n/locale";
import { LOCALE_COOKIE } from "@/infrastructure/i18n/request";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** 手動切換介面語言：記在 cookie，之後每一頁都用它 */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
