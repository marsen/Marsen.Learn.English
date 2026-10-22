import type { ExamSetStatus } from "./examSet";

/**
 * 老師審稿（純資料與規則）。
 * 一套題只保留最新一次審稿（老師可以改判，以最後一次為準）。
 */
export type ReviewDecision = "approved" | "rejected";

export type QuestionNote = { questionId: string; note: string };

export type TeacherReview = {
  setId: string;
  reviewerId: string;
  decision: ReviewDecision;
  /** 整體意見 */
  comment: string | null;
  /** 對錄音的建議（可含 [mm:ss] 時間標記） */
  audioNote: string | null;
  /** 每一小題的建議 */
  questionNotes: QuestionNote[];
  reviewedAt: Date;
};

/**
 * 審稿紀錄：每送出一次審稿就記一筆，不會被改判或刪題組蓋掉（算老師費用用）。
 * 題組名稱記當時的，題組刪掉後也看得到。
 */
export type ReviewRecord = {
  setId: string;
  setTitle: string;
  reviewerId: string;
  decision: ReviewDecision;
  reviewedAt: Date;
};

export const MAX_NOTE_LENGTH = 2000;

export function isReviewDecision(v: unknown): v is ReviewDecision {
  return v === "approved" || v === "rejected";
}

export function statusAfter(decision: ReviewDecision): ExamSetStatus {
  return decision;
}

/** 空白當作沒寫；太長回傳 null 由呼叫端報錯 */
export function cleanNote(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

/** 審稿內容的問題（代碼）；畫面再轉成使用者的語言 */
export type ReviewProblem =
  | { code: "decisionRequired" }
  | { code: "commentTooLong"; max: number }
  | { code: "audioNoteTooLong"; max: number }
  | { code: "unknownQuestion"; questionId: string }
  | { code: "questionNoteTooLong"; questionId: string; max: number };

/** 檢查審稿內容；回傳所有問題，空陣列代表可以存 */
export function reviewProblems(input: {
  decision: unknown;
  comment: string | null;
  audioNote: string | null;
  questionNotes: QuestionNote[];
  knownQuestionIds: readonly string[];
}): ReviewProblem[] {
  const max = MAX_NOTE_LENGTH;
  const problems: ReviewProblem[] = [];
  if (!isReviewDecision(input.decision)) problems.push({ code: "decisionRequired" });
  const tooLong = (s: string | null) => s !== null && s.length > MAX_NOTE_LENGTH;
  if (tooLong(input.comment)) problems.push({ code: "commentTooLong", max });
  if (tooLong(input.audioNote)) problems.push({ code: "audioNoteTooLong", max });
  for (const n of input.questionNotes) {
    if (!input.knownQuestionIds.includes(n.questionId))
      problems.push({ code: "unknownQuestion", questionId: n.questionId });
    if (tooLong(n.note))
      problems.push({ code: "questionNoteTooLong", questionId: n.questionId, max });
  }
  return problems;
}

/** [mm:ss] 時間標記，給錄音建議用 */
export function timeMark(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `[${mm}:${ss}]`;
}
