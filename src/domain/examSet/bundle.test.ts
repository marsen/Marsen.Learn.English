import { describe, it, expect } from "vitest";
import {
  audioKeyFor,
  bundleProblems,
  toPublicTiming,
  transcriptProblems,
  type BundleFacts,
} from "./bundle";

const audio = { bytes: 20_000, sha256: "abcdef1234567890" };
const ok: BundleFacts = {
  schemaVersion: 2,
  declaredAudio: audio,
  actualAudio: audio,
  validateOk: true,
  aiVerdict: "needs_human",
};

describe("bundleProblems", () => {
  it("應該接受完整的打包檔（AI 有疑慮也可以上傳，交給老師）", () => {
    expect(bundleProblems(ok)).toEqual([]);
    expect(bundleProblems({ ...ok, aiVerdict: "pass" })).toEqual([]);
  });

  it("應該擋下不支援的版本", () => {
    expect(bundleProblems({ ...ok, schemaVersion: 1 })).toHaveLength(1);
    expect(bundleProblems({ ...ok, schemaVersion: 3 })).toHaveLength(1);
  });

  it("應該擋下和 set.json 不一致的錄音", () => {
    expect(
      bundleProblems({ ...ok, actualAudio: { ...audio, sha256: "other" } }),
    ).toHaveLength(1);
    expect(
      bundleProblems({ ...ok, actualAudio: { ...audio, bytes: 20_001 } }),
    ).toHaveLength(1);
  });

  it("應該擋下太小的錄音", () => {
    const tiny = { bytes: 100, sha256: "x" };
    expect(
      bundleProblems({ ...ok, declaredAudio: tiny, actualAudio: tiny }),
    ).toHaveLength(1);
  });

  it("應該擋下驗證沒通過或沒有 AI 結論的題組", () => {
    expect(bundleProblems({ ...ok, validateOk: false })).toHaveLength(1);
    expect(bundleProblems({ ...ok, aiVerdict: undefined })).toHaveLength(1);
  });
});

describe("toPublicTiming", () => {
  it("應該拿掉逐字稿與說話者，只留播放需要的欄位", () => {
    const t = toPublicTiming({
      total_seconds: 10,
      events: [{ type: "line", id: "l1", start: 0, end: 2, text: "Hello", speaker: "A" }],
    });
    expect(t).toEqual({
      totalSeconds: 10,
      events: [{ type: "line", id: "l1", start: 0, end: 2 }],
    });
  });
});

describe("audioKeyFor", () => {
  it("應該用題組 id 加雜湊前 8 碼", () => {
    expect(audioKeyFor("s1-gym-0001", "abcdef1234567890")).toBe(
      "s1-gym-0001/audio-abcdef12.mp3",
    );
  });
});

describe("transcriptProblems", () => {
  const turns = ["t1", "t2", "t3"];
  const t = {
    turns: turns.map((id) => ({ id, speaker: "A", text: `line ${id}` })),
    evidence: [
      { questionId: "q01", turn: "t2", quote: "line t2" },
      { questionId: "q02", turn: "t3", quote: "line t3" },
    ],
  };

  it("應該讓跟時間軸、答案卡都對得上的逐字稿通過", () => {
    expect(transcriptProblems(t, turns, ["q01", "q02"])).toEqual([]);
  });

  it("應該擋下句數或順序跟時間軸不同的逐字稿", () => {
    expect(transcriptProblems(t, ["t1", "t2"], ["q01", "q02"])).toHaveLength(1);
    expect(transcriptProblems(t, ["t2", "t1", "t3"], ["q01", "q02"])).toHaveLength(1);
  });

  it("應該擋下指到不存在的句子、多出或缺少題目的出處", () => {
    const bad = {
      ...t,
      evidence: [
        { questionId: "q01", turn: "t9", quote: "?" },
        { questionId: "q99", turn: "t1", quote: "?" },
      ],
    };
    const problems = transcriptProblems(bad, turns, ["q01", "q02"]);
    expect(problems).toEqual(
      expect.arrayContaining([
        { code: "evidenceUnknownTurn", questionId: "q01", turn: "t9" },
        { code: "evidenceUnknownQuestion", questionId: "q99" },
        { code: "evidenceMissing", questionId: "q02" },
      ]),
    );
  });
});
