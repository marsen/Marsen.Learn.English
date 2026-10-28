import { describe, expect, it } from "vitest";
import { isFilterEmpty, matchesFilter, type ExamSetSummary } from "./examSetFilter";

const set: ExamSetSummary = {
  setId: "s1-library-0003",
  title: "Joining the City Library",
  topic: "library membership",
  questionCount: 10,
  aiVerdict: "pass",
  schemaMinor: 0,
  status: "pending_review",
  access: "unlisted",
  uploadedAt: new Date("2026-10-20T00:00:00Z"),
};

describe("matchesFilter", () => {
  it("應該在沒有條件時全部符合", () => {
    expect(matchesFilter(set, {})).toBe(true);
  });

  it("應該照老師狀態、AI 結論、開放對象過濾", () => {
    expect(matchesFilter(set, { status: "pending_review" })).toBe(true);
    expect(matchesFilter(set, { status: "approved" })).toBe(false);
    expect(matchesFilter(set, { aiVerdict: "needs_human" })).toBe(false);
    expect(matchesFilter(set, { access: "unlisted" })).toBe(true);
    expect(matchesFilter(set, { access: "public" })).toBe(false);
  });

  it("應該要所有條件都符合才算", () => {
    expect(matchesFilter(set, { status: "pending_review", access: "public" })).toBe(
      false,
    );
  });

  it("應該用關鍵字比對代號、標題、主題，不分大小寫", () => {
    expect(matchesFilter(set, { keyword: "LIBRARY-0003" })).toBe(true);
    expect(matchesFilter(set, { keyword: "city" })).toBe(true);
    expect(matchesFilter(set, { keyword: "membership" })).toBe(true);
    expect(matchesFilter(set, { keyword: "gym" })).toBe(false);
  });
});

describe("isFilterEmpty", () => {
  it("應該在沒有任何條件時是空的", () => {
    expect(isFilterEmpty({})).toBe(true);
    expect(isFilterEmpty({ keyword: "gym" })).toBe(false);
  });
});
