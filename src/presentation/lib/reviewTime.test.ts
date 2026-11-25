import { describe, it, expect } from "vitest";
import { clock, questionAt, splitTimeRefs, stackCards, turnAt } from "./reviewTime";

const starts = new Map([
  ["t8", 95.5],
  ["t20", 261.4],
]);

describe("splitTimeRefs", () => {
  it("應該把 [mm:ss] 和找得到的句子編號變成可以點的時間", () => {
    expect(splitTimeRefs("at [02:46] and t20, not t99", starts)).toEqual([
      { kind: "text", text: "at " },
      { kind: "time", text: "[02:46]", seconds: 166 },
      { kind: "text", text: " and " },
      { kind: "time", text: "t20 [04:21]", seconds: 261.4, turn: "t20" },
      { kind: "text", text: ", not t99" },
    ]);
  });

  it("應該不把單字裡的 t 加數字當成句子編號", () => {
    expect(splitTimeRefs("at8 t8x", starts)).toEqual([{ kind: "text", text: "at8 t8x" }]);
  });

  const full = new Map([
    ["s1-t10", 60],
    ["s2-t10", 400],
  ]);

  it("應該把完整考卷的 s1-t10 整個認出來，不切成 s1- 和 t10", () => {
    expect(splitTimeRefs("see s2-t10.", full)).toEqual([
      { kind: "text", text: "see " },
      { kind: "time", text: "s2-t10 [06:40]", seconds: 400, turn: "s2-t10" },
      { kind: "text", text: "." },
    ]);
  });

  it("應該把只寫 t10 的意見照所屬 Section 轉成 s{n}-t10，寫法和逐字稿一樣", () => {
    expect(splitTimeRefs("t10", full, 1)).toEqual([
      { kind: "time", text: "s1-t10 [01:00]", seconds: 60, turn: "s1-t10" },
    ]);
    expect(splitTimeRefs("t10", full, 2)).toEqual([
      { kind: "time", text: "s2-t10 [06:40]", seconds: 400, turn: "s2-t10" },
    ]);
  });

  it("應該在不知道 Section（整套的意見）時不猜 t10 是哪一段", () => {
    expect(splitTimeRefs("t10", full)).toEqual([{ kind: "text", text: "t10" }]);
  });

  it("應該讓單段考卷給了 section 也照樣查 t10", () => {
    expect(splitTimeRefs("t8", starts, 1)).toEqual([
      { kind: "time", text: "t8 [01:35]", seconds: 95.5, turn: "t8" },
    ]);
  });

  it("應該讓沒有時間的文字原樣通過", () => {
    expect(splitTimeRefs("plain", starts)).toEqual([{ kind: "text", text: "plain" }]);
    expect(splitTimeRefs("", starts)).toEqual([]);
  });
});

describe("clock", () => {
  it("應該把秒數變成 [mm:ss]", () => {
    expect(clock(0)).toBe("[00:00]");
    expect(clock(297.32)).toBe("[04:57]");
  });
});

describe("questionAt／turnAt", () => {
  const ranges = [
    { questionId: "q01", start: 10, end: 20 },
    { questionId: "q02", start: 20, end: 30 },
    { questionId: "q03", start: null, end: null },
  ];
  it("應該找出正在講答案的那一題", () => {
    expect(questionAt(ranges, 15)).toBe("q01");
    expect(questionAt(ranges, 20)).toBe("q02");
    expect(questionAt(ranges, 5)).toBeNull();
  });
  it("應該找出正在播的那一句", () => {
    const turns = [
      { id: "t1", start: 0 },
      { id: "t2", start: 5 },
    ];
    expect(turnAt(turns, 4.9)).toBe("t1");
    expect(turnAt(turns, 6)).toBe("t2");
  });
});

describe("stackCards", () => {
  it("應該把卡片排在想要的位置，疊到的往下推", () => {
    expect(
      stackCards(
        [
          { want: 0, height: 100 },
          { want: 50, height: 40 },
          { want: 300, height: 10 },
        ],
        10,
      ),
    ).toEqual([0, 110, 300]);
  });
});
