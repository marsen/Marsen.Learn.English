import type { ExamSet } from "./examSet";

/**
 * 能不能刪掉一套題組（審不過才刪）。回傳不能刪的原因；null 代表可以刪。
 * 有人寫過就不刪，免得考試紀錄找不到題目。
 */
export function discardProblem(
  set: Pick<ExamSet, "status">,
  attemptCount: number,
): string | null {
  if (set.status !== "rejected") return "只有老師退回的題組可以刪除";
  if (attemptCount > 0) return "已經有人寫過這套題，不能刪除";
  return null;
}
