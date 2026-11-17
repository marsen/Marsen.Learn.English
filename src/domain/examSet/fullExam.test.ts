import { describe, it, expect } from "vitest";
import {
  estimatedBand,
  isFullExamPaper,
  questionNumberOf,
  sectionRangesOf,
  sectionScores,
} from "./fullExam";

const paper = {
  sections: [
    { ielts_section: 1, first_question: 1, last_question: 10, blocks: [] },
    { ielts_section: 4, first_question: 31, last_question: 40, blocks: [] },
  ],
};

describe("完整考卷", () => {
  it("題目卷有 sections 才是完整考卷", () => {
    expect(isFullExamPaper(paper)).toBe(true);
    expect(isFullExamPaper({ type: "form_table", rows: [] })).toBe(false);
  });

  it("讀出各段的題號範圍；2.x 是空的", () => {
    expect(sectionRangesOf(paper)).toEqual([
      { section: 1, first: 1, last: 10 },
      { section: 4, first: 31, last: 40 },
    ]);
    expect(sectionRangesOf({ rows: [] })).toEqual([]);
  });

  it("題號 q31 是 31，認不得是 null", () => {
    expect(questionNumberOf("q31")).toBe(31);
    expect(questionNumberOf("q01")).toBe(1);
    expect(questionNumberOf("x1")).toBeNull();
  });

  it("各段答對幾題照題號分段（題號不連續也對）", () => {
    const results = [
      { questionId: "q01", correct: true },
      { questionId: "q02", correct: false },
      { questionId: "q31", correct: true },
      { questionId: "q40", correct: true },
    ];
    expect(sectionScores(sectionRangesOf(paper), results)).toEqual([
      { section: 1, correct: 1, total: 2 },
      { section: 4, correct: 2, total: 2 },
    ]);
  });
});

describe("estimatedBand", () => {
  it("照換算表：40 題的錨點", () => {
    expect(estimatedBand(40, 40)).toBe(9);
    expect(estimatedBand(39, 40)).toBe(9);
    expect(estimatedBand(38, 40)).toBe(8.5);
    expect(estimatedBand(35, 40)).toBe(8);
    expect(estimatedBand(30, 40)).toBe(7);
    expect(estimatedBand(29, 40)).toBe(6.5);
    expect(estimatedBand(23, 40)).toBe(6);
    expect(estimatedBand(16, 40)).toBe(5);
    expect(estimatedBand(15, 40)).toBe(4.5);
    expect(estimatedBand(1, 40)).toBe(1);
    expect(estimatedBand(0, 40)).toBe(0);
  });

  it("不是 40 題的考卷不換算", () => {
    expect(estimatedBand(10, 10)).toBeNull();
    expect(estimatedBand(18, 20)).toBeNull();
  });
});
