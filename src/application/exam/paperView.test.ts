import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toFullPaperView, toPaperView, toSheetPapers } from "./paperView";
import { parseFullExam } from "@/application/examSet/fullExamJson";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/set.sample.json", import.meta.url),
    "utf8",
  ),
);

describe("toPaperView", () => {
  it("應該依段落分組，空格依序編號 1–10", () => {
    const v = toPaperView(fixture.paper);
    expect(v.title).toBe("Sample Sports Club Registration");
    const blanks = v.sections
      .flatMap((s) => s.rows.flatMap((r) => r.parts))
      .filter((p) => p.kind === "blank");
    expect(blanks.map((b) => (b.kind === "blank" ? b.number : 0))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(blanks[0]).toEqual({ kind: "blank", questionId: "q01", number: 1 });
  });

  it("應該照 section_styles 決定是一行一行還是一段文字", () => {
    const v = toPaperView(fixture.paper);
    const style = (t: string) => v.sections.find((s) => s.title === t)?.style;
    expect(style("Personal details")).toBe("list");
    expect(style("Study or work")).toBe("paragraph");
  });
});

describe("toFullPaperView", () => {
  const exam = JSON.parse(
    readFileSync(
      new URL("../../../tests/fixtures/exam.sample.json", import.meta.url),
      "utf8",
    ),
  );
  const r = parseFullExam(exam);
  if (!r.ok) throw new Error("fixture 不合格");
  const paper = r.bundle.paper;

  it("完整考卷分四段，題號照全卷位置", () => {
    const v = toFullPaperView(paper)!;
    expect(v.sections.map((s) => [s.ielts, s.first, s.last])).toEqual([
      [1, 1, 10],
      [2, 11, 20],
      [3, 21, 30],
      [4, 31, 40],
    ]);
    expect(v.sections[1].blocks.map((b) => b.kind)).toEqual(["choice", "matching"]);
    const choice = v.sections[1].blocks[0];
    expect(choice.kind === "choice" && choice.questions[0]).toMatchObject({
      questionId: "q11",
      number: 11,
      options: [{ key: "A" }, { key: "B" }, { key: "C" }],
    });
    const matching = v.sections[1].blocks[1];
    expect(matching.kind === "matching" && matching.items[0].number).toBe(16);
    // Section 4 的填空從 31 開始
    const form = v.sections[3].blocks[0];
    const firstBlank =
      form.kind === "form" &&
      form.paper.sections[0].rows.flatMap((x) => x.parts).find((p) => p.kind === "blank");
    expect(firstBlank).toMatchObject({ questionId: "q31", number: 31 });
  });

  it("2.x 不是完整考卷：fullPaper 是 null，paper 照舊", () => {
    expect(toFullPaperView(fixture.paper)).toBeNull();
    expect(toSheetPapers(fixture.paper).paper.sections.length).toBeGreaterThan(0);
    expect(toSheetPapers(paper).fullPaper).not.toBeNull();
  });
});
