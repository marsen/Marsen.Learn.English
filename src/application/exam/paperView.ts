import { z } from "zod";
import type { JsonObject } from "@/domain/examSet/examSet";

/**
 * 題目卷整理成畫面好畫的樣子（照雅思答題卷：分段標題，段內是一行一行的筆記或連成一小段文字，
 * 空格前面有題號）。題目卷本來就是考生看得到的內容，不含答案。
 */
export type PaperPart =
  { kind: "text"; text: string } | { kind: "blank"; questionId: string; number: number };

export type PaperRow = { label: string | null; inline: boolean; parts: PaperPart[] };

export type PaperSection = {
  title: string | null;
  style: "list" | "paragraph";
  rows: PaperRow[];
};

export type PaperView = {
  title: string;
  instruction: string | null;
  sections: PaperSection[];
};

const schema = z
  .object({
    title: z.string().catch(""),
    instruction: z.string().nullish(),
    section_styles: z.record(z.string(), z.string()).nullish(),
    rows: z.array(
      z
        .object({
          label: z.string().nullish(),
          section: z.string().nullish(),
          inline: z.boolean().nullish(),
          parts: z.array(
            z.object({ text: z.string().nullish(), blank: z.string().nullish() }).loose(),
          ),
        })
        .loose(),
    ),
  })
  .loose();

export function toPaperView(paper: JsonObject): PaperView {
  const p = schema.parse(paper);
  const sections: PaperSection[] = [];
  let n = 0;
  for (const row of p.rows) {
    const title = row.section ?? null;
    let section = sections.at(-1);
    if (!section || section.title !== title) {
      const style =
        title && p.section_styles?.[title] === "paragraph" ? "paragraph" : "list";
      section = { title, style, rows: [] };
      sections.push(section);
    }
    section.rows.push({
      label: row.label ?? null,
      inline: row.inline ?? false,
      parts: row.parts.flatMap((part): PaperPart[] => {
        if (part.blank) return [{ kind: "blank", questionId: part.blank, number: ++n }];
        if (part.text != null) return [{ kind: "text", text: part.text }];
        return [];
      }),
    });
  }
  return { title: p.title, instruction: p.instruction ?? null, sections };
}
