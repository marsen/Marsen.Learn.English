import type { Locale } from "@/domain/i18n/locale";

/** 各語言的翻譯檔（messages/<語言>.json） */
export async function loadMessages(locale: Locale) {
  return (await import(`../../../messages/${locale}.json`)).default;
}
