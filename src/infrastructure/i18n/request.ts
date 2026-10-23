import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "@/domain/i18n/locale";
import { loadMessages } from "./messages";

export const TIME_ZONE = "Asia/Taipei";

/**
 * next-intl 的請求設定：網址不帶語言，第一次的語言由 cookie（手動切換過）→ 瀏覽器語言決定。
 * 之後切換在瀏覽器完成（presentation/components/LocaleProvider）。
 */
export default getRequestConfig(async () => {
  const locale = resolveLocale({
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
  return { locale, messages: await loadMessages(locale), timeZone: TIME_ZONE };
});
