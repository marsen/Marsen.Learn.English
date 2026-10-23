/**
 * 日期時間的顯示格式，全站共用。時區固定台灣時間。
 * locale 從 next-intl 的 useLocale() / getLocale() 拿；沒給用繁中（只有管理員看的頁面還沒翻譯）。
 */
const TZ = "Asia/Taipei";
const DEFAULT_LOCALE = "zh-TW";

/** 10/23 14:05 */
export const formatDateTime = (d: Date, locale: string = DEFAULT_LOCALE) =>
  d.toLocaleString(locale, {
    timeZone: TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** 10/23 */
export const formatDay = (d: Date, locale: string = DEFAULT_LOCALE) =>
  d.toLocaleDateString(locale, { timeZone: TZ, month: "numeric", day: "numeric" });

/** 2026/10/23 下午2:05:09（含年份與秒） */
export const formatFullDateTime = (d: Date, locale: string = DEFAULT_LOCALE) =>
  d.toLocaleString(locale, { timeZone: TZ });
