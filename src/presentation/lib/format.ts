/**
 * 日期時間的顯示格式，全站共用（之後多語系只改這裡）。
 * 時區固定台灣時間。
 */
const TZ = "Asia/Taipei";
const LOCALE = "zh-TW";

/** 10/23 14:05 */
export const formatDateTime = (d: Date) =>
  d.toLocaleString(LOCALE, {
    timeZone: TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** 10/23 */
export const formatDay = (d: Date) =>
  d.toLocaleDateString(LOCALE, { timeZone: TZ, month: "numeric", day: "numeric" });

/** 2026/10/23 下午2:05:09（含年份與秒） */
export const formatFullDateTime = (d: Date) => d.toLocaleString(LOCALE, { timeZone: TZ });
