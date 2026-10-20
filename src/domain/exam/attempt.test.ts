import { describe, it, expect } from "vitest";
import {
  normalizeAnswers,
  ownsAttempt,
  MAX_ANSWER_LENGTH,
  type Attempt,
} from "./attempt";

const attempt = (accountId: string | null): Attempt => ({
  id: "a",
  setId: "s",
  accountId,
  answers: null,
  result: null,
  startedAt: new Date(),
  submittedAt: null,
});

describe("ownsAttempt", () => {
  it("應該只讓本人動有帳號的作答", () => {
    expect(ownsAttempt(attempt("u1"), "u1")).toBe(true);
    expect(ownsAttempt(attempt("u1"), "u2")).toBe(false);
    expect(ownsAttempt(attempt("u1"), null)).toBe(false);
  });

  it("應該讓拿得到 id 的人動路人的作答", () => {
    expect(ownsAttempt(attempt(null), null)).toBe(true);
  });
});

describe("normalizeAnswers", () => {
  it("應該只收這張考卷的題號，沒寫的記成空字串", () => {
    expect(normalizeAnswers({ q01: " 52 ", q99: "x", q02: 3 }, ["q01", "q02"])).toEqual({
      q01: "52",
      q02: "",
    });
  });

  it("應該截斷過長的答案", () => {
    const long = "a".repeat(MAX_ANSWER_LENGTH + 10);
    expect(normalizeAnswers({ q01: long }, ["q01"]).q01).toHaveLength(MAX_ANSWER_LENGTH);
  });
});
