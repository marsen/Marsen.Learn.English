import { describe, it, expect } from "vitest";
import { discardProblem } from "./discard";

describe("discardProblem", () => {
  it("應該讓沒人寫過的退回題組可以刪", () => {
    expect(discardProblem({ status: "rejected" }, 0)).toBeNull();
  });

  it("應該不讓待審或合格的題組刪除", () => {
    expect(discardProblem({ status: "pending_review" }, 0)).not.toBeNull();
    expect(discardProblem({ status: "approved" }, 0)).not.toBeNull();
  });

  it("應該不讓有人寫過的題組刪除", () => {
    expect(discardProblem({ status: "rejected" }, 1)).not.toBeNull();
  });
});
