import { describe, it, expect } from "vitest";
import { statusTagsOf, studentsCanTake } from "./statusTags";

describe("statusTagsOf", () => {
  it("應該在 AI 通過且老師通過時加上全 PASS", () => {
    expect(statusTagsOf({ aiVerdict: "pass", status: "approved" })).toEqual([
      "FULL_PASS",
      "AIP",
      "TP",
    ]);
  });

  it("應該在 AI 有疑慮但老師通過時不給全 PASS", () => {
    expect(statusTagsOf({ aiVerdict: "needs_human", status: "approved" })).toEqual([
      "AI_WARN",
      "TP",
    ]);
  });

  it("應該標出老師退回與待審", () => {
    expect(statusTagsOf({ aiVerdict: "pass", status: "rejected" })).toEqual([
      "AIP",
      "TR",
    ]);
    expect(statusTagsOf({ aiVerdict: "needs_human", status: "pending_review" })).toEqual([
      "AI_WARN",
      "WAIT",
    ]);
  });
});

describe("studentsCanTake", () => {
  it("應該讓公開的考卷不看審稿狀態，學生都考得到", () => {
    expect(studentsCanTake({ status: "pending_review", access: "public" })).toBe(true);
    expect(studentsCanTake({ status: "rejected", access: "public" })).toBe(true);
  });

  it("應該讓上架的考卷要審稿通過才考得到", () => {
    expect(studentsCanTake({ status: "approved", access: "members" })).toBe(true);
    expect(studentsCanTake({ status: "pending_review", access: "members" })).toBe(false);
    expect(studentsCanTake({ status: "rejected", access: "members" })).toBe(false);
  });

  it("應該讓下架的考卷誰都考不到", () => {
    expect(studentsCanTake({ status: "approved", access: "unlisted" })).toBe(false);
  });
});
