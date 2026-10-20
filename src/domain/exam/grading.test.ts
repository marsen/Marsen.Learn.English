import { describe, it, expect } from "vitest";
import { grade, matchesAnswer, normalize, type AnswerKeyEntry } from "./grading";

// 測試案例照搬舊版 legacy/tests/answer.test.mjs，確保新舊批改結果一致

describe("normalize", () => {
  it("應該處理大小寫、空白、結尾標點、撇號", () => {
    expect(normalize("  Hargreaves.  ")).toBe("hargreaves");
    expect(normalize("Civil   Engineering!")).toBe("civil engineering");
    expect(normalize("O’Brien")).toBe("o'brien");
    expect(normalize("King-Street")).toBe("king-street");
  });
});

const e = (
  policy: AnswerKeyEntry["policy"],
  answer: string,
  accepted: string[] = [],
) => ({
  policy,
  answer,
  accepted,
});

describe("matchesAnswer", () => {
  it("exact_word：拼錯就是錯；連字號等同空白", () => {
    const k = e("exact_word", "Harlow Road");
    expect(matchesAnswer(k, "harlow road.")).toBe(true);
    expect(matchesAnswer(k, "Harlow-Road")).toBe(true);
    expect(matchesAnswer(k, "Harlo Road")).toBe(false);
    expect(matchesAnswer(k, "")).toBe(false);
    expect(matchesAnswer(e("exact_word", "color", ["colour"]), "colour")).toBe(true);
  });

  it("date_equivalence：日月順序與序數都算對", () => {
    const k = e("date_equivalence", "14 March");
    for (const g of ["14 March", "March 14", "14th March", "14th of March", "mar 14"]) {
      expect(matchesAnswer(k, g)).toBe(true);
    }
    expect(matchesAnswer(k, "13 March")).toBe(false);
    expect(matchesAnswer(k, "14 April")).toBe(false);
    expect(matchesAnswer(k, "March")).toBe(false);
  });

  it("digits_only：去掉空白與連字號，有字母就錯", () => {
    const k = e("digits_only", "07700900123");
    expect(matchesAnswer(k, "07700 900 123")).toBe(true);
    expect(matchesAnswer(k, "07700-900-123")).toBe(true);
    expect(matchesAnswer(k, "07700 900 124")).toBe(false);
    expect(matchesAnswer(e("digits_only", "15"), "15 Street")).toBe(false);
  });

  it("number_word：2 與 two 相同，只處理 0 到 20", () => {
    const k = e("number_word", "3");
    expect(matchesAnswer(k, "three")).toBe(true);
    expect(matchesAnswer(k, "3")).toBe(true);
    expect(matchesAnswer(k, "four")).toBe(false);
    expect(matchesAnswer(e("number_word", "30"), "thirty")).toBe(false);
  });
});

describe("grade", () => {
  it("應該算出分數，題號照順序，沒寫的算錯", () => {
    const key: AnswerKeyEntry[] = [
      { questionId: "q01", ...e("digits_only", "52") },
      { questionId: "q02", ...e("exact_word", "Kestrel Lane") },
      { questionId: "q03", ...e("exact_word", "Hollinwick") },
    ];
    const r = grade(key, { q01: "52", q02: "kestrel-lane" });
    expect(r.score).toBe(2);
    expect(r.total).toBe(3);
    expect(r.results.map((x) => [x.number, x.correct, x.given])).toEqual([
      [1, true, "52"],
      [2, true, "kestrel-lane"],
      [3, false, ""],
    ]);
  });
});
