import type { AiVerdict, ExamSetStatus } from "@/domain/examSet/examSet";

export const AI_VERDICT_LABELS: Record<AiVerdict, string> = {
  pass: "AI 審稿通過",
  needs_human: "AI 有疑慮，需要老師看",
};

export const STATUS_LABELS: Record<ExamSetStatus, string> = {
  pending_review: "待老師審稿",
};
