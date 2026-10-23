import type { AbstractIntlMessages } from "next-intl";
import { LOCALES, type Locale } from "@/domain/i18n/locale";

/** 各語言的翻譯檔（messages/<語言>.json） */
export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  return (await import(`../../../messages/${locale}.json`)).default;
}

/** 所有語言的翻譯檔：一起送到瀏覽器，切換時不用再下載 */
export async function loadAllMessages(): Promise<Record<Locale, AbstractIntlMessages>> {
  const entries = await Promise.all(LOCALES.map(async (l) => [l, await loadMessages(l)]));
  return Object.fromEntries(entries);
}
