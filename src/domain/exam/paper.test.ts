import { describe, it, expect } from "vitest";
import { blanksOf } from "./paper";

describe("blanksOf", () => {
  it("應該照順序找出所有空格題號", () => {
    const paper = {
      rows: [
        { parts: [{ text: "Fee" }] },
        { parts: [{ text: "Address:" }, { blank: "q01" }, { blank: "q02" }] },
        { parts: [{ blank: "q03" }] },
      ],
    };
    expect(blanksOf(paper)).toEqual(["q01", "q02", "q03"]);
  });

  it("完整考卷：逐段收填空、單選、配對的題號", () => {
    const paper = {
      sections: [
        {
          blocks: [{ type: "form", form: { rows: [{ parts: [{ blank: "q01" }] }] } }],
        },
        {
          blocks: [
            {
              type: "choice",
              questions: [{ question_id: "q11" }, { question_id: "q12" }],
            },
            { type: "matching", items: [{ question_id: "q16" }] },
          ],
        },
      ],
    };
    expect(blanksOf(paper)).toEqual(["q01", "q11", "q12", "q16"]);
  });

  it("應該容忍格式不完整的題目卷", () => {
    expect(blanksOf({})).toEqual([]);
    expect(blanksOf({ rows: [{}, { parts: "x" }] })).toEqual([]);
  });
});
