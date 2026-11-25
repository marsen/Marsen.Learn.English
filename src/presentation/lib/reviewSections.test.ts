import { describe, it, expect } from "vitest";
import {
  canComplete,
  isJudged,
  missingOf,
  nextPending,
  sectionAt,
  sectionOfQuestion,
  sectionProgress,
  sectionStart,
  sectionsOf,
  signature,
  type SectionState,
} from "./reviewSections";

const questions = [
  { questionId: "q01", ieltsSection: 1 },
  { questionId: "q02", ieltsSection: 1 },
  { questionId: "q11", ieltsSection: 2 },
  { questionId: "q12", ieltsSection: 2 },
];
const aiNotes = [
  { ref: "finding:0", questionId: "q02", ieltsSection: 1 },
  { ref: "finding:1", questionId: null, ieltsSection: 1 },
];
const state = (s: Partial<SectionState> = {}): SectionState => ({
  verdicts: new Map(),
  aiActions: new Map(),
  seen: new Set(),
  confirmed: {},
  ...s,
});

describe("reviewSections", () => {
  it("段落與題目所在段", () => {
    expect(sectionsOf([...questions].reverse())).toEqual([1, 2]);
    expect(sectionOfQuestion(questions, "q11")).toBe(2);
  });

  it("沒判＝還沒判；判有問題就算判過，AI 意見不用處理", () => {
    expect(missingOf(aiNotes, state(), "q02")).toEqual([{ kind: "unjudged" }]);
    expect(isJudged(aiNotes, state({ verdicts: new Map([["q02", false]]) }), "q02")).toBe(
      true,
    );
  });

  it("判 OK：AI 意見要處理或改寫，而且要老師看過（預設 OK 要確認）", () => {
    const s = state({ verdicts: new Map([["q02", true]]), seen: new Set(["q02"]) });
    expect(missingOf(aiNotes, s, "q02")).toEqual([{ kind: "aiOpen", count: 1 }]);
    expect(
      isJudged(
        aiNotes,
        { ...s, aiActions: new Map([["finding:0", { action: "edited" as const }]]) },
        "q02",
      ),
    ).toBe(true);
    expect(
      missingOf(aiNotes, state({ verdicts: new Map([["q01", true]]) }), "q01"),
    ).toEqual([{ kind: "confirmDefault" }]);
  });

  const s1Done = state({
    verdicts: new Map([
      ["q01", true],
      ["q02", false],
    ]),
    seen: new Set(["q01", "q02"]),
  });

  it("段落完成要按過完成，而且之後沒改；改了就回到進行中", () => {
    expect(sectionProgress(questions, aiNotes, s1Done, 1)).toMatchObject({
      ok: 1,
      bad: 1,
      pending: 0,
      status: "inProgress",
    });
    const sig = signature(questions, aiNotes, s1Done, 1);
    const confirmed = { ...s1Done, confirmed: { "1": sig } };
    expect(sectionProgress(questions, aiNotes, confirmed, 1).status).toBe("done");
    const changed = {
      ...confirmed,
      verdicts: new Map([...confirmed.verdicts, ["q02", true] as const]),
    };
    expect(sectionProgress(questions, aiNotes, changed, 1).status).toBe("inProgress");
    // 整段 AI 意見的處理不影響段落完成
    const sectionNote = {
      ...confirmed,
      aiActions: new Map([["finding:1", { action: "deleted" as const }]]),
    };
    expect(sectionProgress(questions, aiNotes, sectionNote, 1).status).toBe("done");
  });

  it("OK 只算判過的：預設 OK 沒確認、AI 意見沒處理的算待處理，不重複算", () => {
    const s = state({
      verdicts: new Map([
        ["q01", true],
        ["q02", true],
      ]),
      seen: new Set(["q02"]),
    });
    // q01 預設 OK 沒確認、q02 有 AI 意見沒處理：兩題都還沒判過
    const p = sectionProgress(questions, aiNotes, s, 1);
    expect(p).toMatchObject({ ok: 0, bad: 0, pending: 2 });
    expect(p.ok + p.bad + p.pending).toBe(2);
  });

  it("沒看過任何一題的段是還沒開始", () => {
    expect(sectionProgress(questions, aiNotes, state(), 2).status).toBe("notStarted");
  });

  it("完成照順序：前一段完成才按得下", () => {
    const s = state({
      verdicts: new Map([
        ["q11", true],
        ["q12", true],
      ]),
      seen: new Set(["q11", "q12"]),
    });
    expect(canComplete(questions, aiNotes, s, 2)).toEqual({ ok: false, waitFor: 1 });
    expect(canComplete(questions, aiNotes, s1Done, 1)).toEqual({ ok: true });
    expect(canComplete(questions, aiNotes, state(), 1)).toEqual({
      ok: false,
      waitFor: null,
    });
    const both = {
      ...s,
      verdicts: new Map([...s.verdicts, ...s1Done.verdicts]),
      seen: new Set([...s.seen, ...s1Done.seen]),
      confirmed: { "1": signature(questions, aiNotes, s1Done, 1) },
    };
    expect(canComplete(questions, aiNotes, both, 2)).toEqual({ ok: true });
  });

  it("下一個待處理跨段找，繞回開頭，最後是整套", () => {
    expect(nextPending(questions, aiNotes, s1Done, "q02", "set")).toBe("q11");
    expect(nextPending(questions, aiNotes, s1Done, "q12", "set")).toBe("q11");
    const all = state({
      verdicts: new Map(questions.map((q) => [q.questionId, false])),
    });
    expect(nextPending(questions, aiNotes, all, null, "set")).toBe("set");
    expect(
      nextPending(
        questions,
        aiNotes,
        { ...all, verdicts: new Map([...all.verdicts, ["set", true]]) },
        null,
        "set",
      ),
    ).toBeNull();
  });

  it("段落開頭和正在播哪段", () => {
    const events = [
      { id: "s1-intro", start: 0 },
      { id: "s2-intro", start: 456.57 },
      { id: "s2-t1", start: 470 },
    ];
    expect(sectionStart(events, 2)).toBe(456.57);
    expect(sectionStart(events, 3)).toBeNull();
    expect(sectionAt(events, [1, 2], 100)).toBe(1);
    expect(sectionAt(events, [1, 2], 500)).toBe(2);
  });
});
