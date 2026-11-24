import type { AiVerdict, ExamSetStatus } from "./examSet";

/**
 * 題組清單上的狀態籤：
 * - AI：AIP（通過）／AI_WARN（有疑慮）
 * - 老師：TP（通過）／TR（退回）／WAIT（待審）
 * - FULL_PASS：AIP ＋ TP
 * 籤只講審稿狀態；考不考得到還要看開放對象（規則在 access.ts 的 canTake）。
 */
export type StatusTag = "FULL_PASS" | "AIP" | "AI_WARN" | "TP" | "TR" | "WAIT";

export function statusTagsOf(set: {
  aiVerdict: AiVerdict;
  status: ExamSetStatus;
}): StatusTag[] {
  const ai: StatusTag = set.aiVerdict === "pass" ? "AIP" : "AI_WARN";
  const teacher: StatusTag =
    set.status === "approved" ? "TP" : set.status === "rejected" ? "TR" : "WAIT";
  return ai === "AIP" && teacher === "TP" ? ["FULL_PASS", ai, teacher] : [ai, teacher];
}
