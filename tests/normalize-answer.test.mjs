import test from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../generator/normalize.mjs";
import { matchesAnswer, findInText } from "../generator/answer.mjs";

test("normalize：大小寫、空白、結尾標點、撇號", () => {
  assert.equal(normalize("  Hargreaves.  "), "hargreaves");
  assert.equal(normalize("Civil   Engineering!"), "civil engineering");
  assert.equal(normalize("O’Brien"), "o'brien");
  assert.equal(normalize("King-Street"), "king-street"); // normalize 不處理連字號
});

test("exact_word：拼錯就是錯；連字號等同空白只在這個策略成立", () => {
  const e = { answer: "Harlow Road", accepted: [] };
  assert.ok(matchesAnswer("exact_word", "harlow road.", e));
  assert.ok(matchesAnswer("exact_word", "Harlow-Road", e));
  assert.ok(!matchesAnswer("exact_word", "Harlo Road", e));
  assert.ok(!matchesAnswer("exact_word", "", e));
  assert.ok(matchesAnswer("exact_word", "colour", { answer: "color", accepted: ["colour"] }));
});

test("date_equivalence：順序與序數", () => {
  const e = { answer: "14 March", accepted: [] };
  for (const g of ["14 March", "March 14", "14th March", "14th of March", "mar 14"]) assert.ok(matchesAnswer("date_equivalence", g, e), g);
  assert.ok(!matchesAnswer("date_equivalence", "13 March", e));
  assert.ok(!matchesAnswer("date_equivalence", "14 April", e));
  assert.ok(!matchesAnswer("date_equivalence", "March", e));
});

test("digits_only：去掉空白與連字號，有字母就錯", () => {
  const e = { answer: "07700900123", accepted: [] };
  assert.ok(matchesAnswer("digits_only", "07700 900 123", e));
  assert.ok(matchesAnswer("digits_only", "07700-900-123", e));
  assert.ok(!matchesAnswer("digits_only", "07700 900 124", e));
  assert.ok(!matchesAnswer("digits_only", "15 Street", { answer: "15", accepted: [] }));
});

test("number_word：2 與 two 相同，只處理 0 到 20", () => {
  const e = { answer: "3", accepted: [] };
  assert.ok(matchesAnswer("number_word", "three", e));
  assert.ok(matchesAnswer("number_word", "3", e));
  assert.ok(!matchesAnswer("number_word", "four", e));
  assert.ok(!matchesAnswer("number_word", "thirty", e));
});

test("findInText：各策略在逐字稿裡找答案", () => {
  assert.ok(findInText("exact_word", { answer: "Eastside" }, "I think the Eastside branch is closer"));
  assert.equal(findInText("exact_word", { answer: "East" }, "the Eastside branch"), null); // 整詞比對
  assert.ok(findInText("exact_word", { answer: "Hargreaves" }, "That's H-A-R-G-R-E-A-V-E-S."));
  assert.ok(findInText("date_equivalence", { answer: "14 March" }, "the 14th of March"));
  assert.ok(findInText("digits_only", { answer: "3417" }, "It's 3417, and it's printed"));
  assert.equal(findInText("digits_only", { answer: "15" }, "It's 150 pounds"), null);
});
