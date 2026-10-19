import { describe, it, expect } from "vitest";
import {
  cleanNote,
  reviewProblems,
  statusAfter,
  timeMark,
  MAX_NOTE_LENGTH,
} from "./review";

const base = {
  decision: "approved",
  comment: null,
  audioNote: null,
  questionNotes: [],
  knownQuestionIds: ["q01", "q02"],
};

describe("reviewProblems", () => {
  it("應該接受只有判定、沒有任何意見的審稿", () => {
    expect(reviewProblems(base)).toEqual([]);
  });

  it("應該要求選合格或不合格", () => {
    expect(reviewProblems({ ...base, decision: "maybe" })).toHaveLength(1);
  });

  it("應該擋下不存在的小題", () => {
    expect(
      reviewProblems({ ...base, questionNotes: [{ questionId: "q99", note: "x" }] }),
    ).toHaveLength(1);
  });

  it("應該擋下太長的意見、錄音建議與小題建議", () => {
    const long = "字".repeat(MAX_NOTE_LENGTH + 1);
    expect(
      reviewProblems({
        ...base,
        comment: long,
        audioNote: long,
        questionNotes: [{ questionId: "q01", note: long }],
      }),
    ).toHaveLength(3);
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
