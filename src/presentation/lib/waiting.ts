const DAY_MS = 24 * 60 * 60 * 1000;

/** 上傳後等了多久：未滿一天顯示「今天」 */
export function waitedLabel(since: Date, now: Date): string {
  const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
  return days <= 0 ? "今天" : `${days} 天`;
}
