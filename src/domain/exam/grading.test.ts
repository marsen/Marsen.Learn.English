import { describe, it, expect } from "vitest";
import {
  grade,
  matchesAnswer,
  normalize,
  numberWordToDigits,
  type AnswerKeyEntry,
} from "./grading";

// 測試案例照搬舊版 legacy/tests/answer.test.mjs（commit dad7a51），確保新舊批改結果一致

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

  it("number_word：2 與 two 相同，英文數字認到 999", () => {
    const k = e("number_word", "3");
    expect(matchesAnswer(k, "three")).toBe(true);
    expect(matchesAnswer(k, "3")).toBe(true);
    expect(matchesAnswer(k, "four")).toBe(false);
    expect(matchesAnswer(e("number_word", "30"), "thirty")).toBe(true);
    expect(matchesAnswer(e("number_word", "30"), "thirty-one")).toBe(false);
  });
});

// 以下案例照搬出題工具 Question.Generator 的 tests/test_marking.py（Backlog #252），兩邊批改結果要一致

describe("numberWordToDigits", () => {
  it.each([
    ["twenty-five", "25"],
    ["twenty five", "25"],
    ["one hundred and five", "105"],
    ["ninety", "90"],
    ["a hundred", "100"],
    ["twenty", "20"],
    ["zero", "0"],
    ["hundred", null],
    ["a", null],
    ["ten hundred", null],
    ["thirty twelve", null],
    ["thirty hundred", null],
    ["5 people", null],
  ])("%s → %s", (given, expected) => {
    expect(numberWordToDigits(given)).toBe(expected);
  });
});

describe("matchesAnswer：價錢與英文數字（digits_only）", () => {
  it.each([
    ["£37", "37"],
    ["£ 37", "37"],
    ["37 pounds", "37"],
    ["1 pound", "1"],
    ["£37.", "37"],
    ["thirty-seven", "37"],
    ["thirty seven", "37"],
    ["Thirty-Seven", "37"],
    ["thirty-seven pounds", "37"],
    ["£116", "116"],
    ["one hundred and sixteen", "116"],
    ["a hundred and sixteen", "116"],
    ["one hundred sixteen", "116"],
    ["nine hundred and ninety-nine", "999"],
    ["two hundred", "200"],
    ["07700 900386", "07700 900 386"],
    ["07700-900-386", "07700 900 386"],
    ["37", "37"],
  ])("%s 對 %s 算對", (given, answer) => {
    expect(matchesAnswer(e("digits_only", answer), given)).toBe(true);
  });

  it.each([
    ["oh seven seven", "077"],
    ["thirty seven people", "37"],
    ["37 dollars", "37"],
    ["thirty-eight", "37"],
    ["£38", "37"],
    ["abc", "37"],
    ["one thousand", "1000"],
    ["zero seven seven zero zero nine zero zero three eight six", "07700 900 386"],
  ])("%s 對 %s 算錯", (given, answer) => {
    expect(matchesAnswer(e("digits_only", answer), given)).toBe(false);
  });
});

describe("matchesAnswer：日期的斜線寫法（date_equivalence）", () => {
  const k = e("date_equivalence", "28 May");

  it.each(["28/5", "5/28", "28/05", "05/28", "28th of May", "May 28th"])(
    "%s 算對",
    (given) => {
      expect(matchesAnswer(k, given)).toBe(true);
    },
  );

  it.each(["the 28th of May", "28.5", "28/6", "32/5", "28/13", "28/5/2026", "28/", "/5"])(
    "%s 算錯",
    (given) => {
      expect(matchesAnswer(k, given)).toBe(false);
    },
  );

  it("日小於等於 12 的舊題組，兩種順序都算對", () => {
    const old = e("date_equivalence", "2 November");
    expect(matchesAnswer(old, "2/11")).toBe(true);
    expect(matchesAnswer(old, "11/2")).toBe(true);
    expect(matchesAnswer(old, "3/11")).toBe(false);
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
