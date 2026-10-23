const DAY_MS = 24 * 60 * 60 * 1000;

/** 上傳後等了幾天（未滿一天是 0）；畫面再用翻譯檔 waited.* 顯示「今天」或「N 天」 */
export function waitedDays(since: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
}
