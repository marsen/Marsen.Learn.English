import { describe, it, expect } from "vitest";
import { statusTagsOf } from "./statusTags";

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
