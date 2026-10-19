import type { ExamAccess, PublicTiming } from "@/domain/examSet/examSet";
import type { PaperView } from "./paperView";

/** 考卷清單上的一張 */
export type AvailableExam = {
  setId: string;
  title: string;
  questionCount: number;
  access: ExamAccess;
};

/** 開始考試後給考生的內容：題目卷、時間軸。不含答案、不含逐字稿 */
export type ExamSheet = {
  attemptId: string;
  setId: string;
  title: string;
  paper: PaperView;
  timing: PublicTiming;
};

export type StartExamResult =
  { ok: true; sheet: ExamSheet } | { ok: false; reason: "not_available" };

export type SubmitExamResult =
  { ok: true } | { ok: false; reason: "not_found" | "already_submitted" };
