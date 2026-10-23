import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/domain/i18n/locale";
import { loadMessages } from "./messages";

/** next-intl 的請求設定：網址不帶語言，用 cookie（手動切換）→ 瀏覽器語言決定 */
export const LOCALE_COOKIE = "locale";

export default getRequestConfig(async () => {
  const locale = resolveLocale({
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
  return { locale, messages: await loadMessages(locale), timeZone: "Asia/Taipei" };
});
