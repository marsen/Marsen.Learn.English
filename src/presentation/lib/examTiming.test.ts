import { describe, it, expect } from "vitest";
import { eventAt, formatClock, questionRange, viewOf } from "./examTiming";

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

  it("應該把秒數與題號範圍寫成中文", () => {
    expect(formatClock(65.2)).toBe("1:06");
    expect(questionRange([1, 6])).toEqual({ kind: "range", a: 1, b: 6 });
    expect(questionRange([3, 4])).toEqual({ kind: "pair", a: 3, b: 4 });
    expect(questionRange([5, 5])).toEqual({ kind: "single", a: 5, b: 5 });
  });
});
