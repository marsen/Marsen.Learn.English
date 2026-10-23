import { describe, it, expect } from "vitest";
import { aiSeverity, chipSummary } from "./reviewNotes";

describe("aiSeverity", () => {
  it("應該照 AI 審稿標的嚴重程度，認不得的算提醒", () => {
    expect(aiSeverity({ kind: "finding", severity: "block", aiRuling: null })).toBe(
      "block",
    );
    expect(aiSeverity({ kind: "finding", severity: "warn", aiRuling: null })).toBe(
      "warn",
    );
    expect(aiSeverity({ kind: "finding", severity: "huh", aiRuling: null })).toBe("info");
  });

  it("應該把 AI 判為誤報的程式示警算提醒，其他算注意", () => {
    expect(aiSeverity({ kind: "warning", severity: null, aiRuling: "ok" })).toBe("info");
    expect(aiSeverity({ kind: "warning", severity: null, aiRuling: "problem" })).toBe(
      "warn",
    );
    expect(aiSeverity({ kind: "warning", severity: null, aiRuling: null })).toBe("warn");
  });
});

describe("chipSummary", () => {
  it("應該算出還在的 AI 意見、老師意見、刪掉的數量與最嚴重的程度", () => {
    expect(
      chipSummary(
        [
          { severity: "info", deleted: false },
          { severity: "block", deleted: true },
          { severity: "warn", deleted: false },
        ],
        2,
      ),
    ).toEqual({ ai: 2, teacher: 2, deleted: 1, worst: "warn" });
  });

  it("應該在沒有 AI 意見時沒有嚴重程度", () => {
    expect(chipSummary([], 1)).toEqual({ ai: 0, teacher: 1, deleted: 0, worst: null });
  });
});
