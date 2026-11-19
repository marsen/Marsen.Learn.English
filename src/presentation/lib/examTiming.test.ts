import { describe, it, expect } from "vitest";
import { eventAt, formatClock, questionRange, sectionOf, viewOf } from "./examTiming";

const events = [
  { type: "announce", id: "intro", start: 0, end: 8 },
  { type: "pause", id: "read1", start: 8, end: 38, questions: [1, 6] },
  { type: "line", id: "l1", start: 38, end: 41 },
  { type: "pause", id: "check", start: 300, end: 330 },
];

describe("examTiming", () => {
  it("應該找出目前的事件，空檔回 null", () => {
    expect(eventAt(events, 10)?.id).toBe("read1");
    expect(eventAt(events, 100)).toBeNull();
  });

  it("應該分出聽、看題、檢查", () => {
    expect(viewOf(eventAt(events, 1), 1)).toEqual({ kind: "listen" });
    expect(viewOf(eventAt(events, 18), 18)).toEqual({
      kind: "read",
      remaining: 20,
      questions: [1, 6],
    });
    expect(viewOf(eventAt(events, 310), 310)).toEqual({ kind: "check", remaining: 20 });
  });

  it("完整考卷每段的 s<n>-check 也是檢查時間；s4-pause1 是看題", () => {
    const full = [
      { type: "pause", id: "s4-pause1", start: 0, end: 30, questions: [31, 40] },
      { type: "pause", id: "s4-check", start: 30, end: 60, questions: [31, 40] },
    ];
    expect(viewOf(eventAt(full, 10), 10)).toEqual({
      kind: "read",
      remaining: 20,
      questions: [31, 40],
    });
    expect(viewOf(eventAt(full, 40), 40)).toEqual({ kind: "check", remaining: 20 });
  });

  it("應該把秒數與題號範圍寫成中文", () => {
    expect(formatClock(65.2)).toBe("1:06");
    expect(questionRange([1, 6])).toEqual({ kind: "range", a: 1, b: 6 });
    expect(questionRange([3, 4])).toEqual({ kind: "pair", a: 3, b: 4 });
    expect(questionRange([5, 5])).toEqual({ kind: "single", a: 5, b: 5 });
  });
});

describe("sectionOf", () => {
  const full = [
    { type: "turn", id: "s1-t20", start: 0, end: 10 },
    { type: "pause", id: "s2-pause1", start: 12, end: 40 },
  ];
  it("應該從事件 id 認出完整考卷的第幾段", () => {
    expect(sectionOf(eventAt(full, 5))).toBe(1);
    expect(sectionOf(eventAt(full, 20))).toBe(2);
  });
  it("應該在空檔、單段考卷回 null（畫面沿用上一段）", () => {
    expect(sectionOf(eventAt(full, 11))).toBeNull();
    expect(sectionOf(eventAt(events, 10))).toBeNull();
  });
});
