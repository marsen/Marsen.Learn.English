import { describe, it, expect } from "vitest";
import { narratorVoicesOf } from "./narratorVoices";

const kokoroA = {
  id: "bm_fable",
  engine: "kokoro",
  accent: "en-GB",
  gender: "m",
  age: "young",
  can_spell: false,
};
const breezeB = {
  id: "breeze-us-f-middle-1",
  engine: "breeze",
  ref: "us-f-middle-1",
  accent: "en-US",
  gender: "f",
  age: "middle",
  can_spell: true,
};

describe("narratorVoicesOf（2.x 單段）", () => {
  it("列出旁白 A、B 各用哪個引擎、聲音、口音、性別、年齡", () => {
    const r = narratorVoicesOf(
      {
        answers: { answers: [], cast: { B: breezeB, A: kokoroA, speller: "B" } },
        provenance: {},
      },
      false,
    );
    expect(r).toEqual([
      {
        ieltsSection: null,
        narrators: [
          {
            role: "A",
            engine: "kokoro",
            voice: "bm_fable",
            accent: "en-GB",
            gender: "m",
            age: "young",
          },
          {
            role: "B",
            engine: "breeze",
            voice: "breeze-us-f-middle-1",
            accent: "en-US",
            gender: "f",
            age: "middle",
          },
        ],
      },
    ]);
  });

  it("只有一位旁白就只列 A", () => {
    const r = narratorVoicesOf(
      { answers: { cast: { A: kokoroA, speller: null } }, provenance: {} },
      false,
    );
    expect(r[0].narrators.map((n) => n.role)).toEqual(["A"]);
  });

  it("缺欄位（例如舊資料沒有 engine）是 null，不會變成 undefined", () => {
    const r = narratorVoicesOf(
      { answers: { cast: { A: { id: "bm_daniel", accent: "en-GB" } } }, provenance: {} },
      false,
    );
    expect(r[0].narrators[0]).toEqual({
      role: "A",
      engine: null,
      voice: "bm_daniel",
      accent: "en-GB",
      gender: null,
      age: null,
    });
  });

  it("欄位型別不對或是空字串當作沒記錄", () => {
    const r = narratorVoicesOf(
      { answers: { cast: { A: { id: 3, engine: "", gender: ["m"] } } }, provenance: {} },
      false,
    );
    expect(r[0].narrators[0]).toMatchObject({ voice: null, engine: null, gender: null });
  });

  it("沒有 cast 時回一段、沒有旁白", () => {
    expect(narratorVoicesOf({ answers: { answers: [] }, provenance: {} }, false)).toEqual(
      [{ ieltsSection: null, narrators: [] }],
    );
    expect(
      narratorVoicesOf({ answers: { cast: "壞掉" }, provenance: {} }, false),
    ).toEqual([{ ieltsSection: null, narrators: [] }]);
  });
});

describe("narratorVoicesOf（完整考卷）", () => {
  it("照 Section 順序各列一段；沒有 cast 的段落旁白是空的", () => {
    const r = narratorVoicesOf(
      {
        answers: { answers: [] },
        provenance: {
          sections: [
            { ielts_section: 3, cast: { A: kokoroA, B: breezeB } },
            { ielts_section: 1, cast: { A: { id: "bm_daniel" } } },
            { ielts_section: 4 },
            { ielts_section: 2, cast: { A: kokoroA, speller: null } },
          ],
        },
      },
      true,
    );
    expect(r.map((s) => s.ieltsSection)).toEqual([1, 2, 3, 4]);
    expect(r.map((s) => s.narrators.map((n) => n.role))).toEqual([
      ["A"],
      ["A"],
      ["A", "B"],
      [],
    ]);
  });

  it("早期上傳、製作紀錄沒有分段資料時回空清單", () => {
    expect(narratorVoicesOf({ answers: {}, provenance: {} }, true)).toEqual([]);
  });
});
