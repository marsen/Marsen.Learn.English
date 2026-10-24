import type { ExamSetStatus } from "./examSet";

/**
 * 老師審稿（純資料與規則）。
 * 一套題只保留最新一次審稿（老師可以改判，以最後一次為準）。
 */
export type ReviewDecision = "approved" | "rejected";

/** 老師自己寫的意見。target 是題號（q01…）；null＝整套／錄音，不屬於某一題 */
export type ReviewNote = { target: string | null; text: string };

/**
 * 老師對一條 AI 意見的處理。沒有記錄就是「保留」（老師同意 AI 的說法）。
 * - edited：老師改寫，text 是改寫後的內容（AI 原文還在題組的製作紀錄裡）
 * - deleted：老師認為不是問題，text 是原因（選填）
 */
export type AiNoteAction = {
  /** 哪一條 AI 意見，見 aiNoteRef */
  ref: string;
  action: "edited" | "deleted";
  text: string | null;
};

/**
 * 老師對一題（或整套）的判定：ok＝沒問題，false＝有問題。target 是題號；null＝整套／錄音。
 * 跟有沒有意見無關：有意見但判 OK 也算通過。
 */
export type ItemVerdict = { target: string | null; ok: boolean };

export type TeacherReview = {
  setId: string;
  reviewerId: string;
  /** 整套的結果：由每題、整套的判定算出來（全部 OK 才合格），見 decisionFrom */
  decision: ReviewDecision;
  /** 每一題、整套的判定；舊審稿（還沒有逐題判定時）是空陣列 */
  verdicts: ItemVerdict[];
  /** 整體意見 */
  comment: string | null;
  /** 老師的意見（每題的、整套的；可含 [mm:ss] 時間標記） */
  notes: ReviewNote[];
  /** 老師對 AI 意見的處理（保留的不記） */
  aiActions: AiNoteAction[];
  reviewedAt: Date;
};

/**
 * AI 意見的代號：程式示警用示警編號（warning:w01），AI 審稿的發現用出現順序（finding:0）。
 * 題組的製作紀錄上傳後不會變，所以代號固定。
 */
export function aiNoteRef(kind: "warning" | "finding", id: string | number): string {
  return `${kind}:${id}`;
}

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

/** 全部 OK 才合格，有一項有問題就不合格 */
export function decisionFrom(verdicts: readonly ItemVerdict[]): ReviewDecision {
  return verdicts.every((v) => v.ok) ? "approved" : "rejected";
}

/** 還沒判的項目（整套是 null）；required 是這套題要判的全部項目 */
export function missingVerdicts(
  verdicts: readonly ItemVerdict[],
  required: readonly (string | null)[],
): (string | null)[] {
  return required.filter((t) => !verdicts.some((v) => v.target === t));
}

/** 空白當作沒寫；太長回傳 null 由呼叫端報錯 */
export function cleanNote(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

/** 審稿內容的問題（代碼）；畫面再轉成使用者的語言 */
export type ReviewProblem =
  | { code: "verdictMissing"; count: number }
  | { code: "commentTooLong"; max: number }
  | { code: "unknownQuestion"; questionId: string }
  | { code: "noteTooLong"; max: number }
  | { code: "unknownAiNote" }
  | { code: "editedAiNoteEmpty" };

/** 檢查審稿內容；回傳所有問題（同一種只報一次），空陣列代表可以存 */
export function reviewProblems(input: {
  verdicts: ItemVerdict[];
  comment: string | null;
  notes: ReviewNote[];
  aiActions: AiNoteAction[];
  knownQuestionIds: readonly string[];
  knownAiRefs: readonly string[];
}): ReviewProblem[] {
  const max = MAX_NOTE_LENGTH;
  const problems: ReviewProblem[] = [];
  const add = (p: ReviewProblem) => {
    if (!problems.some((x) => JSON.stringify(x) === JSON.stringify(p))) problems.push(p);
  };
  // 每一題和整套都要判；不認得的題號也擋
  for (const v of input.verdicts)
    if (v.target !== null && !input.knownQuestionIds.includes(v.target))
      add({ code: "unknownQuestion", questionId: v.target });
  const missing = missingVerdicts(input.verdicts, [null, ...input.knownQuestionIds]);
  if (missing.length > 0) add({ code: "verdictMissing", count: missing.length });
  const tooLong = (s: string | null) => s !== null && s.length > MAX_NOTE_LENGTH;
  if (tooLong(input.comment)) add({ code: "commentTooLong", max });
  for (const n of input.notes) {
    if (n.target !== null && !input.knownQuestionIds.includes(n.target))
      add({ code: "unknownQuestion", questionId: n.target });
    if (tooLong(n.text)) add({ code: "noteTooLong", max });
  }
  for (const a of input.aiActions) {
    if (!input.knownAiRefs.includes(a.ref)) add({ code: "unknownAiNote" });
    if (a.action === "edited" && !a.text) add({ code: "editedAiNoteEmpty" });
    if (tooLong(a.text)) add({ code: "noteTooLong", max });
  }
  return problems;
}

/** 老師的意見：去掉空白、空的不算 */
export function cleanNotes(raw: { target: string | null; text: string }[]): ReviewNote[] {
  return raw.flatMap((n) => {
    const text = cleanNote(n.text);
    return text ? [{ target: n.target, text }] : [];
  });
}

/** 判定：同一項只留最後一次 */
export function cleanVerdicts(raw: readonly ItemVerdict[]): ItemVerdict[] {
  const byTarget = new Map<string | null, ItemVerdict>();
  for (const v of raw) byTarget.set(v.target, { target: v.target, ok: v.ok });
  return [...byTarget.values()];
}

/** 對 AI 意見的處理：去掉空白；同一條只留最後一次 */
export function cleanAiActions(
  raw: { ref: string; action: "edited" | "deleted"; text: string | null }[],
): AiNoteAction[] {
  const byRef = new Map<string, AiNoteAction>();
  for (const a of raw) byRef.set(a.ref, { ...a, text: cleanNote(a.text) });
  return [...byRef.values()];
}

/** [mm:ss] 時間標記，給錄音建議用 */
export function timeMark(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `[${mm}:${ss}]`;
}
