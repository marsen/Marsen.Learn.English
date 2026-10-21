/**
 * 台灣時間的月份（台灣沒有日光節約，固定 UTC+8）。
 * 月份字串格式 YYYY-MM，例如 2026-10。
 */
const OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** 台灣時間這個月 1 號 00:00 */
export function startOfMonthInTaipei(now: Date): Date {
  const t = new Date(now.getTime() + OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - OFFSET_MS);
}

/** now 在台灣時間是哪個月 */
export function monthOf(now: Date): string {
  const t = new Date(now.getTime() + OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 前後移幾個月 */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 月份的範圍 [from, to)；格式不對回傳 null */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const hit = MONTH.exec(month);
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]) - 1;
  return {
    from: new Date(Date.UTC(y, m, 1) - OFFSET_MS),
    to: new Date(Date.UTC(y, m + 1, 1) - OFFSET_MS),
  };
}
