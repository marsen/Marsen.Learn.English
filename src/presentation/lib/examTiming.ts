import type { TimingEvent } from "@/domain/examSet/examSet";

/**
 * 考試頁跟著錄音時間軸走：目前在聽、看題停頓、還是最後檢查。（沿用舊版 exam/core.mjs 的邏輯）
 */
export type ExamPhaseView =
  | { kind: "listen" }
  | { kind: "read"; remaining: number; questions: [number, number] | null }
  | { kind: "check"; remaining: number };

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 目前播放秒數落在哪個事件；事件之間的短空檔回傳 null（畫面維持上一個狀態） */
export function eventAt(events: TimingEvent[], t: number): TimingEvent | null {
  return (
    events.find(
      (e) => e.start !== undefined && e.end !== undefined && t >= e.start && t < e.end,
    ) ?? null
  );
}

export function viewOf(event: TimingEvent | null, t: number): ExamPhaseView | null {
  if (!event) return null;
  if (event.type !== "pause") return { kind: "listen" };
  const remaining = Math.max(0, (event.end ?? t) - t);
  if (event.id === "check") return { kind: "check", remaining };
  const q = event.questions;
  const questions =
    Array.isArray(q) && q.length === 2 && q.every((x) => typeof x === "number")
      ? ([q[0], q[1]] as [number, number])
      : null;
  return { kind: "read", remaining, questions };
}

/** 看題提示要怎麼寫題號：一題、相鄰兩題、一段範圍（文字在翻譯檔 exam.questions.*） */
export type QuestionRange = { kind: "single" | "pair" | "range"; a: number; b: number };

export function questionRange([a, b]: [number, number]): QuestionRange {
  return { kind: a === b ? "single" : b - a === 1 ? "pair" : "range", a, b };
}
