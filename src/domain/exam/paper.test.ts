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

  it("應該容忍格式不完整的題目卷", () => {
    expect(blanksOf({})).toEqual([]);
    expect(blanksOf({ rows: [{}, { parts: "x" }] })).toEqual([]);
  });
});
