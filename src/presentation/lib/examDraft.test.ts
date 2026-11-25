import { describe, it, expect } from "vitest";
import type { FullPaperView, PaperView } from "@/application/exam/paperView";
import {
  clearDraft,
  clearOtherDrafts,
  draftKey,
  findDraftForSet,
  loadDraft,
  questionIdsOf,
  saveDraft,
  sectionQuestionIds,
  unansweredBySection,
  unansweredCount,
  type DraftStorage,
} from "./examDraft";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const broken: DraftStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const form = (ids: string[]): PaperView => ({
  title: "",
  instruction: null,
  sections: [
    {
      title: null,
      style: "list",
      rows: [
        {
          label: null,
          inline: false,
          parts: ids.flatMap((id, i) => [
            { kind: "text" as const, text: "x" },
            { kind: "blank" as const, questionId: id, number: i + 1 },
          ]),
        },
      ],
    },
  ],
});

describe("examDraft", () => {
  it("應該每次作答一個鍵，存了讀得回來（含作答、題組、存的時間）", () => {
    const s = memory();
    const now = new Date("2026-11-18T00:00:00Z");
    expect(
      saveDraft(s, { attemptId: "a1", setId: "s1", answers: { q1: "cat" } }, now),
    ).toBe(true);
    expect(s.data.has(draftKey("a1"))).toBe(true);
    expect(loadDraft(s, "a1")).toEqual({
      attemptId: "a1",
      setId: "s1",
      answers: { q1: "cat" },
      savedAt: "2026-11-18T00:00:00.000Z",
    });
    expect(loadDraft(s, "a2")).toBeNull();
  });

  it("再存一次應該蓋過舊的", () => {
    const s = memory();
    saveDraft(s, { attemptId: "a1", setId: "s1", answers: { q1: "c" } });
    saveDraft(s, { attemptId: "a1", setId: "s1", answers: { q1: "ca", q2: "dog" } });
    expect(loadDraft(s, "a1")?.answers).toEqual({ q1: "ca", q2: "dog" });
  });

  it("交卷後刪掉就讀不到", () => {
    const s = memory();
    saveDraft(s, { attemptId: "a1", setId: "s1", answers: { q1: "c" } });
    clearDraft(s, "a1");
    expect(loadDraft(s, "a1")).toBeNull();
  });

  it("開始新考試時清掉其他次的暫存，只留這次的，別的資料不動", () => {
    const s = memory();
    saveDraft(s, { attemptId: "old1", setId: "s1", answers: { q1: "a" } });
    saveDraft(s, { attemptId: "old2", setId: "s2", answers: {} });
    saveDraft(s, { attemptId: "now", setId: "s1", answers: {} });
    s.data.set("NEXT_LOCALE", "en");
    clearOtherDrafts(s, "now");
    expect([...s.data.keys()].sort()).toEqual(["NEXT_LOCALE", draftKey("now")].sort());
    expect(() =>
      clearOtherDrafts({ ...broken, length: 1, key: () => draftKey("x") }, "now"),
    ).not.toThrow();
    expect(() => clearOtherDrafts(null, "now")).not.toThrow();
  });

  it("瀏覽器不給存（私密瀏覽、空間滿）時不丟錯", () => {
    expect(saveDraft(broken, { attemptId: "a1", setId: "s1", answers: {} })).toBe(false);
    expect(loadDraft(broken, "a1")).toBeNull();
    expect(() => clearDraft(broken, "a1")).not.toThrow();
    expect(saveDraft(null, { attemptId: "a1", setId: "s1", answers: {} })).toBe(false);
    expect(loadDraft(null, "a1")).toBeNull();
  });

  it("存的內容壞掉或形狀不對時回 null，非字串的答案略過", () => {
    const s = memory();
    s.data.set(draftKey("a1"), "{not json");
    expect(loadDraft(s, "a1")).toBeNull();
    s.data.set(
      draftKey("a1"),
      JSON.stringify({ attemptId: "other", setId: "s", answers: {}, savedAt: "t" }),
    );
    expect(loadDraft(s, "a1")).toBeNull();
    s.data.set(
      draftKey("a1"),
      JSON.stringify({
        attemptId: "a1",
        setId: "s",
        answers: { q1: "x", q2: 3 },
        savedAt: "t",
      }),
    );
    expect(loadDraft(s, "a1")?.answers).toEqual({ q1: "x" });
  });

  it("沒填的題數＝題目卷所有空格減有填的；只有空白算沒填", () => {
    const ids = questionIdsOf(form(["q1", "q2", "q3"]), null);
    expect(ids).toEqual(["q1", "q2", "q3"]);
    expect(unansweredCount(ids, {})).toBe(3);
    expect(unansweredCount(ids, { q1: "cat", q2: "  " })).toBe(2);
    expect(unansweredCount(ids, { q1: "a", q2: "b", q3: "c" })).toBe(0);
    // 不在題目卷上的鍵不算
    expect(unansweredCount(ids, { zzz: "a" })).toBe(3);
  });

  it("完整考卷：填空、單選、配對的空格都算", () => {
    const full: FullPaperView = {
      sections: [
        {
          ielts: 1,
          title: "",
          first: 1,
          last: 4,
          blocks: [
            { kind: "form", paper: form(["f1", "f2"]) },
            {
              kind: "choice",
              instruction: null,
              questions: [{ questionId: "c1", number: 3, stem: "", options: [] }],
            },
            {
              kind: "matching",
              instruction: null,
              options: [],
              items: [{ questionId: "m1", number: 4, text: "" }],
            },
          ],
        },
      ],
    };
    const ids = questionIdsOf(form([]), full);
    expect(ids).toEqual(["f1", "f2", "c1", "m1"]);
    expect(unansweredCount(ids, { f1: "x", c1: "A" })).toBe(2);
  });

  it("完整考卷：每一段分開列出題目代號，各段還有幾題沒填分開算，加起來等於整份沒填的題數", () => {
    const full: FullPaperView = {
      sections: [
        {
          ielts: 1,
          title: "",
          first: 1,
          last: 3,
          blocks: [
            { kind: "form", paper: form(["f1", "f2"]) },
            {
              kind: "choice",
              instruction: null,
              questions: [{ questionId: "c1", number: 3, stem: "", options: [] }],
            },
          ],
        },
        {
          ielts: 2,
          title: "",
          first: 4,
          last: 5,
          blocks: [
            {
              kind: "matching",
              instruction: null,
              options: [],
              items: [
                { questionId: "m1", number: 4, text: "" },
                { questionId: "m2", number: 5, text: "" },
              ],
            },
          ],
        },
      ],
    };
    expect(sectionQuestionIds(full)).toEqual([
      { section: 1, questionIds: ["f1", "f2", "c1"] },
      { section: 2, questionIds: ["m1", "m2"] },
    ]);
    const answers = { f1: "x", f2: "  ", m2: "B" };
    const by = unansweredBySection(full, answers);
    // 只有空白也算沒填
    expect(by).toEqual([
      { section: 1, left: 2 },
      { section: 2, left: 1 },
    ]);
    expect(by.reduce((n, s) => n + s.left, 0)).toBe(
      unansweredCount(questionIdsOf(form([]), full), answers),
    );
    expect(
      unansweredBySection(full, { f1: "a", f2: "b", c1: "A", m1: "C", m2: "D" }),
    ).toEqual([
      { section: 1, left: 0 },
      { section: 2, left: 0 },
    ]);
  });
});

describe("findDraftForSet", () => {
  it("找到這份考卷沒交卷的暫存", () => {
    const s = memory();
    saveDraft(s, { attemptId: "a1", setId: "s1", answers: { q1: "x" } });
    saveDraft(s, { attemptId: "a2", setId: "s2", answers: {} });
    expect(findDraftForSet(s, "s1")?.attemptId).toBe("a1");
  });

  it("同一份考卷有好幾份時取最新的", () => {
    const s = memory();
    saveDraft(s, { attemptId: "old", setId: "s1", answers: {} }, new Date("2026-01-01"));
    saveDraft(s, { attemptId: "new", setId: "s1", answers: {} }, new Date("2026-01-02"));
    expect(findDraftForSet(s, "s1")?.attemptId).toBe("new");
  });

  it("沒有、壞掉、別的鍵都回 null", () => {
    const s = memory();
    s.setItem(draftKey("bad"), "{");
    s.setItem("other", JSON.stringify({ setId: "s1" }));
    expect(findDraftForSet(s, "s1")).toBeNull();
    expect(findDraftForSet(null, "s1")).toBeNull();
  });
});
