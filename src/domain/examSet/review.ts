import type { ExamSetStatus } from "./examSet";

/**
 * 老師審稿（純資料與規則）。
 * 一套題只保留最新一次審稿（老師可以改判，以最後一次為準）。
 */
export type ReviewDecision = "approved" | "rejected";

/** 舊版的每題建議（資料庫舊欄位 question_notes 的格式；過渡期還會寫） */
export type QuestionNote = { questionId: string; note: string };

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

export type TeacherReview = {
  setId: string;
  reviewerId: string;
  decision: ReviewDecision;
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

/** 空白當作沒寫；太長回傳 null 由呼叫端報錯 */
export function cleanNote(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

/** 審稿內容的問題（代碼）；畫面再轉成使用者的語言 */
export type ReviewProblem =
  | { code: "decisionRequired" }
  | { code: "commentTooLong"; max: number }
  | { code: "unknownQuestion"; questionId: string }
  | { code: "noteTooLong"; max: number }
  | { code: "unknownAiNote" }
  | { code: "editedAiNoteEmpty" };

/** 檢查審稿內容；回傳所有問題（同一種只報一次），空陣列代表可以存 */
export function reviewProblems(input: {
  decision: unknown;
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
  if (!isReviewDecision(input.decision)) add({ code: "decisionRequired" });
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

/** 對 AI 意見的處理：去掉空白；同一條只留最後一次 */
export function cleanAiActions(
  raw: { ref: string; action: "edited" | "deleted"; text: string | null }[],
): AiNoteAction[] {
  const byRef = new Map<string, AiNoteAction>();
  for (const a of raw) byRef.set(a.ref, { ...a, text: cleanNote(a.text) });
  return [...byRef.values()];
}

/**
 * 舊欄位（audio_note、question_notes）過渡期還要寫，讓還在跑的舊版程式讀得到：
 * 整套的意見併成錄音建議，每題的意見依題號合併。
 */
export function toLegacyNotes(notes: ReviewNote[]): {
  audioNote: string | null;
  questionNotes: QuestionNote[];
} {
  const whole = notes.filter((n) => n.target === null).map((n) => n.text);
  const byQuestion = new Map<string, string[]>();
  for (const n of notes) {
    if (n.target === null) continue;
    byQuestion.set(n.target, [...(byQuestion.get(n.target) ?? []), n.text]);
  }
  return {
    audioNote: whole.length > 0 ? whole.join("\n") : null,
    questionNotes: [...byQuestion].map(([questionId, texts]) => ({
      questionId,
      note: texts.join("\n"),
    })),
  };
}

/** 新欄位還沒有資料的舊審稿：把錄音建議當整套的意見、每題建議當那一題的意見 */
export function fromLegacyNotes(
  audioNote: string | null,
  questionNotes: QuestionNote[],
): ReviewNote[] {
  return [
    ...(audioNote ? [{ target: null, text: audioNote }] : []),
    ...questionNotes.map((n) => ({ target: n.questionId, text: n.note })),
  ];
}

/** [mm:ss] 時間標記，給錄音建議用 */
export function timeMark(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `[${mm}:${ss}]`;
}
