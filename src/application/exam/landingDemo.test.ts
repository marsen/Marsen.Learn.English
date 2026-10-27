import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchesAnswer } from "@/domain/exam/grading";
import { toLandingDemoView } from "./landingDemo";

// 首頁實際用的示意題資料（scripts/make-landing-demo.mjs 產生）
const demo = JSON.parse(
  readFileSync(
    new URL("../../presentation/content/landingDemo.json", import.meta.url),
    "utf8",
  ),
);

describe("toLandingDemoView", () => {
  const view = toLandingDemoView(demo, "/landing-demo/audio.mp3");

  it("應該讀得懂目前的示意題資料，題號從 1 開始", () => {
    expect(view.answers.map((a) => a.number)).toEqual(view.answers.map((_, i) => i + 1));
    expect(view.duration).toBeGreaterThan(0);
  });

  it("應該每一題都有出處，而且出處的句子在逐字稿裡", () => {
    const turns = new Set(view.transcript.map((t) => t.id));
    for (const a of view.answers) {
      const e = view.evidence.find((x) => x.questionId === a.questionId);
      expect(e && turns.has(e.turn)).toBe(true);
    }
  });

  it("應該用正式考試的批改規則批改標準答案", () => {
    for (const a of view.answers) expect(matchesAnswer(a, a.answer)).toBe(true);
  });

  it("應該擋下格式不對的資料", () => {
    expect(() => toLandingDemoView({ ...demo, answers: "x" }, "/a.mp3")).toThrow();
  });
});
