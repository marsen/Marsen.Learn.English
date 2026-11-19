/**
 * 完整考卷的審稿：一段一段審（#288）。都是純函式，畫面狀態由 ReviewForm 持有。
 *
 * 「判過」一題：
 * - 判「有問題」→ 判過，AI 意見不用處理（回饋會是 NEEDS FIXING＋老師同意 AI）
 * - 判「OK」→ 這題每則 AI 意見都已處理（deleted）或改寫（edited）才算；
 *   沒處理就判 OK，出題工具會收到「同意 AI 指出的問題卻判 OK」
 * - 而且老師看過（seen）：預設 OK 的題目要老師再按一次 OK
 *
 * 「段落完成」＝這段每題判過，且按完成時記下的 signature 等於現在的；改了判定就回到進行中。
 */

export type SectionQuestion = { questionId: string; ieltsSection: number | null };
export type SectionAiNote = {
  ref: string;
  questionId: string | null;
  ieltsSection: number | null;
};

export type SectionState = {
  verdicts: ReadonlyMap<string, boolean>;
  aiActions: ReadonlyMap<string, { action: "edited" | "deleted" }>;
  seen: ReadonlySet<string>;
  /** key 是段號字串 */
  confirmed: Readonly<Record<string, string>>;
};

/** 一題還缺什麼 */
export type Missing =
  { kind: "unjudged" } | { kind: "aiOpen"; count: number } | { kind: "confirmDefault" };

/** 題組裡有哪幾段（照順序） */
export function sectionsOf(questions: readonly SectionQuestion[]): number[] {
  return [
    ...new Set(
      questions.flatMap((q) => (q.ieltsSection === null ? [] : [q.ieltsSection])),
    ),
  ].sort((a, b) => a - b);
}

export function sectionOfQuestion(
  questions: readonly SectionQuestion[],
  questionId: string,
): number | null {
  return questions.find((q) => q.questionId === questionId)?.ieltsSection ?? null;
}

export function questionsIn(
  questions: readonly SectionQuestion[],
  section: number,
): string[] {
  return questions.filter((q) => q.ieltsSection === section).map((q) => q.questionId);
}

/** 這題還有幾則 AI 意見沒處理（保留＝沒處理） */
export function openAiCount(
  aiNotes: readonly SectionAiNote[],
  state: Pick<SectionState, "aiActions">,
  questionId: string,
): number {
  return aiNotes.filter((n) => n.questionId === questionId && !state.aiActions.has(n.ref))
    .length;
}

/** 這題要算「判過」還缺什麼；空陣列＝判過 */
export function missingOf(
  aiNotes: readonly SectionAiNote[],
  state: SectionState,
  questionId: string,
): Missing[] {
  const v = state.verdicts.get(questionId);
  if (v === undefined) return [{ kind: "unjudged" }];
  if (v === false) return [];
  const out: Missing[] = [];
  const open = openAiCount(aiNotes, state, questionId);
  if (open > 0) out.push({ kind: "aiOpen", count: open });
  if (!state.seen.has(questionId)) out.push({ kind: "confirmDefault" });
  return out;
}

export function isJudged(
  aiNotes: readonly SectionAiNote[],
  state: SectionState,
  questionId: string,
): boolean {
  return missingOf(aiNotes, state, questionId).length === 0;
}

/** 這段的判定和題目 AI 意見的處理，寫成一個字串；變了就代表回頭改過 */
export function signature(
  questions: readonly SectionQuestion[],
  aiNotes: readonly SectionAiNote[],
  state: Pick<SectionState, "verdicts" | "aiActions">,
  section: number,
): string {
  const ids = questionsIn(questions, section);
  return JSON.stringify(
    ids.map((id) => [
      id,
      state.verdicts.get(id) ?? null,
      aiNotes
        .filter((n) => n.questionId === id)
        .map((n) => [n.ref, state.aiActions.get(n.ref)?.action ?? null]),
    ]),
  );
}

export type SectionProgress = {
  section: number;
  ok: number;
  bad: number;
  /** 還沒判過的題數 */
  pending: number;
  status: "done" | "inProgress" | "notStarted";
};

export function sectionProgress(
  questions: readonly SectionQuestion[],
  aiNotes: readonly SectionAiNote[],
  state: SectionState,
  section: number,
): SectionProgress {
  const ids = questionsIn(questions, section);
  const pending = ids.filter((id) => !isJudged(aiNotes, state, id)).length;
  const done =
    pending === 0 &&
    state.confirmed[String(section)] === signature(questions, aiNotes, state, section);
  return {
    section,
    ok: ids.filter((id) => state.verdicts.get(id) === true).length,
    bad: ids.filter((id) => state.verdicts.get(id) === false).length,
    pending,
    status: done
      ? "done"
      : ids.some((id) => state.seen.has(id))
        ? "inProgress"
        : "notStarted",
  };
}

/** 這段的完成鈕：這段每題判過，而且前一段已完成（第一段不用等） */
export function canComplete(
  questions: readonly SectionQuestion[],
  aiNotes: readonly SectionAiNote[],
  state: SectionState,
  section: number,
): { ok: true } | { ok: false; waitFor: number | null } {
  const order = sectionsOf(questions);
  const before = order[order.indexOf(section) - 1];
  if (
    before !== undefined &&
    sectionProgress(questions, aiNotes, state, before).status !== "done"
  )
    return { ok: false, waitFor: before };
  if (sectionProgress(questions, aiNotes, state, section).pending > 0)
    return { ok: false, waitFor: null };
  return { ok: true };
}

/**
 * 下一個待處理（跨段）：照題目順序，從目前展開的那題往後找，繞回開頭；題目都判過才輪到整套。
 * setTarget 是整套的代號。
 */
export function nextPending(
  questions: readonly SectionQuestion[],
  aiNotes: readonly SectionAiNote[],
  state: SectionState,
  active: string | null,
  setTarget: string,
): string | null {
  const ids = questions.map((q) => q.questionId);
  const from = active ? ids.indexOf(active) : -1;
  const order = [...ids.slice(from + 1), ...ids.slice(0, from + 1)];
  const q = order.find((k) => k !== active && !isJudged(aiNotes, state, k));
  if (q !== undefined) return q;
  if (!state.verdicts.has(setTarget)) return setTarget;
  return active && active !== setTarget && !isJudged(aiNotes, state, active)
    ? active
    : null;
}

type TimingEvent = { id?: unknown; start?: unknown };

/** 第 n 段開頭宣讀（sN-intro）的秒數；找不到是 null */
export function sectionStart(
  events: readonly TimingEvent[],
  section: number,
): number | null {
  const e = events.find((x) => x.id === `s${section}-intro`);
  return typeof e?.start === "number" ? e.start : null;
}

/** 錄音播到第幾段（最後一個開頭不晚於 now 的段）；第一段開頭之前是 null */
export function sectionAt(
  events: readonly TimingEvent[],
  sections: readonly number[],
  now: number,
): number | null {
  let at: number | null = null;
  for (const n of sections) {
    const s = sectionStart(events, n);
    if (s !== null && s <= now) at = n;
  }
  return at;
}
