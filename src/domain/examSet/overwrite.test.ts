import { describe, expect, it } from "vitest";
import type { ExamSet, ExamSetPrivate } from "./examSet";
import { checkOverwrite, sameJson } from "./overwrite";

const set: ExamSet = {
  setId: "s1-customs-0001",
  title: "Visitor Arrival Record",
  topic: "customs",
  questionCount: 10,
  paper: { title: "Visitor Arrival Record", rows: [{ label: "First name", parts: [] }] },
  timing: { totalSeconds: 393, events: [{ type: "turn", id: "t1", start: 0, end: 1 }] },
  audioKey: "s1-customs-0001/audio-4b239214.mp3",
  aiVerdict: "pass",
  schemaMinor: 0,
  status: "approved",
  access: "public",
  uploadedBy: "00000000-0000-0000-0000-000000000001",
  uploadedAt: new Date("2026-10-20"),
};
const secret: ExamSetPrivate = {
  setId: set.setId,
  answers: { answers: [{ question_id: "q01", answer: "Mattias" }] },
  provenance: { generator_version: "0.1.0" },
  transcript: null,
};
const current = { set, secret };

describe("sameJson", () => {
  it("應該不管物件鍵的順序，但在乎陣列順序", () => {
    expect(sameJson({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
  });
});

describe("checkOverwrite", () => {
  it("應該在完全一樣時回 unchanged", () => {
    expect(checkOverwrite(current, structuredClone(current))).toEqual({
      kind: "unchanged",
      fields: [],
    });
  });

  it("應該把只補上逐字稿（2.0 → 2.1）算成 supplement，審核狀態不用動", () => {
    const next = {
      set: { ...set, schemaMinor: 1, status: "pending_review" as const },
      secret: {
        ...secret,
        transcript: { turns: [{ id: "t1", speaker: "A", text: "Hi" }], evidence: [] },
      },
    };
    expect(checkOverwrite(current, next)).toEqual({ kind: "supplement", fields: [] });
  });

  it("應該把題目卷、答案、錄音的改動算成 content，並列出差在哪裡", () => {
    const next = {
      set: {
        ...set,
        paper: { ...set.paper, title: "Changed" },
        audioKey: "s1-customs-0001/audio-99999999.mp3",
      },
      secret: { ...secret, answers: { answers: [] } },
    };
    expect(checkOverwrite(current, next)).toEqual({
      kind: "content",
      fields: ["paper", "answers", "audio"],
    });
  });
});
