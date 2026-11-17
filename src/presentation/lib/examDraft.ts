import type { FullPaperView, PaperView } from "@/application/exam/paperView";

/**
 * 考試中的答案暫存在學生的瀏覽器（localStorage），一次作答一個鍵。
 * 每改一題就存；交卷成功、或網站說這次作答已交／找不到時刪掉。
 * 讀寫都包 try/catch：私密瀏覽、空間滿了寫不進去，考試照常進行。
 */
export type ExamDraft = {
  attemptId: string;
  setId: string;
  answers: Record<string, string>;
  /** 存的時間（ISO） */
  savedAt: string;
};

/** 只用到這三個方法，方便測試時換成假的 */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "exam-draft:";

export function draftKey(attemptId: string): string {
  return `${PREFIX}${attemptId}`;
}

/** 拿瀏覽器的 localStorage；有些瀏覽器連讀 window.localStorage 都會丟錯 */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 存一次；成功回 true，寫不進去回 false（不丟錯） */
export function saveDraft(
  storage: DraftStorage | null,
  draft: Omit<ExamDraft, "savedAt">,
  now: Date = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const value: ExamDraft = { ...draft, savedAt: now.toISOString() };
    storage.setItem(draftKey(draft.attemptId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** 讀回來；沒有、壞掉、形狀不對都回 null */
export function loadDraft(
  storage: DraftStorage | null,
  attemptId: string,
): ExamDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(draftKey(attemptId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ExamDraft> | null;
    if (
      !v ||
      v.attemptId !== attemptId ||
      typeof v.setId !== "string" ||
      typeof v.savedAt !== "string" ||
      typeof v.answers !== "object" ||
      v.answers === null
    )
      return null;
    const answers: Record<string, string> = {};
    for (const [k, a] of Object.entries(v.answers))
      if (typeof a === "string") answers[k] = a;
    return { attemptId, setId: v.setId, answers, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

export function clearDraft(storage: DraftStorage | null, attemptId: string): void {
  if (!storage) return;
  try {
    storage.removeItem(draftKey(attemptId));
  } catch {
    // 刪不掉也不影響交卷
  }
}

/** 開始新考試時用：清掉其他次作答留下的暫存，只留 keepAttemptId 這一次 */
export function clearOtherDrafts(
  storage: (DraftStorage & Pick<Storage, "length" | "key">) | null,
  keepAttemptId: string,
): void {
  if (!storage) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIX) && k !== draftKey(keepAttemptId)) stale.push(k);
    }
    for (const k of stale) storage.removeItem(k);
  } catch {
    // 清不掉也不影響考試
  }
}

/** 題目卷上所有空格（作答格）的題目代號，照畫面順序 */
export function questionIdsOf(
  paper: PaperView,
  fullPaper: FullPaperView | null,
): string[] {
  const fromForm = (p: PaperView) =>
    p.sections.flatMap((s) =>
      s.rows.flatMap((r) =>
        r.parts.flatMap((x) => (x.kind === "blank" ? [x.questionId] : [])),
      ),
    );
  if (!fullPaper) return fromForm(paper);
  return fullPaper.sections.flatMap((s) =>
    s.blocks.flatMap((b) =>
      b.kind === "form"
        ? fromForm(b.paper)
        : b.kind === "choice"
          ? b.questions.map((q) => q.questionId)
          : b.items.map((it) => it.questionId),
    ),
  );
}

/** 還有幾題沒填：只有空白也算沒填（畫面上看起來就是空的） */
export function unansweredCount(
  questionIds: readonly string[],
  answers: Readonly<Record<string, string>>,
): number {
  return [...new Set(questionIds)].filter((id) => (answers[id] ?? "").trim() === "")
    .length;
}
