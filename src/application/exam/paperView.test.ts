import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toPaperView } from "./paperView";

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
