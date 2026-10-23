import { describe, it, expect } from "vitest";
import {
  aiNoteRef,
  cleanAiActions,
  cleanNote,
  cleanNotes,
  fromLegacyNotes,
  reviewProblems,
  toLegacyNotes,
  statusAfter,
  timeMark,
  MAX_NOTE_LENGTH,
} from "./review";

const base = {
  decision: "approved",
  comment: null,
  notes: [],
  aiActions: [],
  knownQuestionIds: ["q01", "q02"],
  knownAiRefs: ["warning:w01", "finding:0"],
};

describe("reviewProblems", () => {
  it("應該接受只有判定、沒有任何意見的審稿", () => {
    expect(reviewProblems(base)).toEqual([]);
  });

  it("應該接受每題的、整套的意見與對 AI 意見的處理", () => {
    expect(
      reviewProblems({
        ...base,
        notes: [
          { target: "q01", text: "太快" },
          { target: null, text: "[01:23] 整段太快" },
        ],
        aiActions: [
          { ref: "warning:w01", action: "deleted", text: null },
          { ref: "finding:0", action: "edited", text: "改成這樣" },
        ],
      }),
    ).toEqual([]);
  });

  it("應該要求選合格或不合格", () => {
    expect(reviewProblems({ ...base, decision: "maybe" })).toEqual([
      { code: "decisionRequired" },
    ]);
  });

  it("應該擋下不存在的小題與不存在的 AI 意見", () => {
    expect(
      reviewProblems({
        ...base,
        notes: [{ target: "q99", text: "x" }],
        aiActions: [{ ref: "warning:w99", action: "deleted", text: null }],
      }),
    ).toEqual([
      { code: "unknownQuestion", questionId: "q99" },
      { code: "unknownAiNote" },
    ]);
  });

  it("應該擋下改寫成空白的 AI 意見", () => {
    expect(
      reviewProblems({
        ...base,
        aiActions: [{ ref: "finding:0", action: "edited", text: null }],
      }),
    ).toEqual([{ code: "editedAiNoteEmpty" }]);
  });

  it("應該擋下太長的整體意見與意見，同一種只報一次", () => {
    const long = "字".repeat(MAX_NOTE_LENGTH + 1);
    expect(
      reviewProblems({
        ...base,
        comment: long,
        notes: [
          { target: "q01", text: long },
          { target: null, text: long },
        ],
        aiActions: [{ ref: "finding:0", action: "edited", text: long }],
      }),
    ).toEqual([
      { code: "commentTooLong", max: MAX_NOTE_LENGTH },
      { code: "noteTooLong", max: MAX_NOTE_LENGTH },
    ]);
  });
});

describe("cleanNotes／cleanAiActions", () => {
  it("應該丟掉空白的意見", () => {
    expect(
      cleanNotes([
        { target: "q01", text: "  " },
        { target: null, text: " 好 " },
      ]),
    ).toEqual([{ target: null, text: "好" }]);
  });

  it("應該讓同一條 AI 意見只留最後一次處理", () => {
    expect(
      cleanAiActions([
        { ref: "finding:0", action: "edited", text: "a" },
        { ref: "finding:0", action: "deleted", text: "  " },
      ]),
    ).toEqual([{ ref: "finding:0", action: "deleted", text: null }]);
  });
});

describe("toLegacyNotes／fromLegacyNotes", () => {
  it("應該把整套的意見併成錄音建議、每題意見依題號合併（給舊版程式讀）", () => {
    expect(
      toLegacyNotes([
        { target: null, text: "A" },
        { target: "q01", text: "B" },
        { target: null, text: "C" },
        { target: "q01", text: "D" },
      ]),
    ).toEqual({
      audioNote: "A\nC",
      questionNotes: [{ questionId: "q01", note: "B\nD" }],
    });
    expect(toLegacyNotes([])).toEqual({ audioNote: null, questionNotes: [] });
  });

  it("應該把舊審稿的錄音建議、每題建議轉成意見", () => {
    expect(fromLegacyNotes("[01:00] 太快", [{ questionId: "q02", note: "x" }])).toEqual([
      { target: null, text: "[01:00] 太快" },
      { target: "q02", text: "x" },
    ]);
  });
});

describe("aiNoteRef", () => {
  it("應該用種類加編號當代號", () => {
    expect(aiNoteRef("warning", "w01")).toBe("warning:w01");
    expect(aiNoteRef("finding", 0)).toBe("finding:0");
  });
});

describe("cleanNote", () => {
  it("應該把空白當作沒寫", () => {
    expect(cleanNote("   ")).toBeNull();
    expect(cleanNote(undefined)).toBeNull();
    expect(cleanNote(" 好 ")).toBe("好");
  });
});

describe("statusAfter", () => {
  it("應該讓合格／不合格變成題組狀態", () => {
    expect(statusAfter("approved")).toBe("approved");
    expect(statusAfter("rejected")).toBe("rejected");
  });
});

describe("timeMark", () => {
  it("應該把秒數變成 [mm:ss]", () => {
    expect(timeMark(83.7)).toBe("[01:23]");
    expect(timeMark(0)).toBe("[00:00]");
  });
});
