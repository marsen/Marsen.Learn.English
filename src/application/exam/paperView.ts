import { z } from "zod";
import type { JsonObject } from "@/domain/examSet/examSet";
import { questionNumberOf } from "@/domain/examSet/fullExam";

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

/** firstNumber：第一個空格的題號（完整考卷的 Section 4 從 31 開始） */
export function toPaperView(paper: JsonObject, firstNumber = 1): PaperView {
  const p = schema.parse(paper);
  const sections: PaperSection[] = [];
  let n = firstNumber - 1;
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

/** 單選、配對的一個選項 */
export type ChoiceOption = { key: string; text: string };

/** 完整考卷的一個區塊：填空（沿用 2.x 的畫法）、單選、配對 */
export type FullPaperBlock =
  | { kind: "form"; paper: PaperView }
  | {
      kind: "choice";
      instruction: string | null;
      questions: {
        questionId: string;
        number: number;
        stem: string;
        options: ChoiceOption[];
      }[];
    }
  | {
      kind: "matching";
      instruction: string | null;
      options: ChoiceOption[];
      items: { questionId: string; number: number; text: string }[];
    };

/** 完整考卷的一段 */
export type FullPaperSection = {
  ielts: number;
  title: string;
  first: number;
  last: number;
  blocks: FullPaperBlock[];
};

export type FullPaperView = { sections: FullPaperSection[] };

const option = z.object({ key: z.string(), text: z.string() }).loose();
const fullSchema = z
  .object({
    sections: z.array(
      z
        .object({
          ielts_section: z.number(),
          title: z.string().catch(""),
          first_question: z.number(),
          last_question: z.number(),
          blocks: z.array(
            z
              .object({
                type: z.string(),
                form: z.record(z.string(), z.unknown()).nullish(),
                instruction: z.string().nullish(),
                questions: z
                  .array(
                    z
                      .object({
                        question_id: z.string(),
                        stem: z.string(),
                        options: z.array(option),
                      })
                      .loose(),
                  )
                  .nullish(),
                options: z.array(option).nullish(),
                items: z
                  .array(z.object({ question_id: z.string(), text: z.string() }).loose())
                  .nullish(),
              })
              .loose(),
          ),
        })
        .loose(),
    ),
  })
  .loose();

/** 完整考卷（題目卷有 sections）整理成分段、分區塊的樣子；題號照全卷位置。不是完整考卷回傳 null */
export function toFullPaperView(paper: JsonObject): FullPaperView | null {
  if (!Array.isArray(paper.sections)) return null;
  const p = fullSchema.parse(paper);
  return {
    sections: p.sections.map((s) => {
      let next = s.first_question;
      const numberOf = (questionId: string) => {
        const n = questionNumberOf(questionId) ?? next;
        next = n + 1;
        return n;
      };
      const pick = (o: { key: string; text: string }) => ({ key: o.key, text: o.text });
      return {
        ielts: s.ielts_section,
        title: s.title,
        first: s.first_question,
        last: s.last_question,
        blocks: s.blocks.flatMap((b): FullPaperBlock[] => {
          if (b.type === "form" && b.form) {
            const view = toPaperView(b.form, next);
            next += view.sections.reduce(
              (acc, sec) =>
                acc +
                sec.rows.reduce(
                  (r, row) => r + row.parts.filter((x) => x.kind === "blank").length,
                  0,
                ),
              0,
            );
            return [{ kind: "form", paper: view }];
          }
          if (b.type === "choice")
            return [
              {
                kind: "choice",
                instruction: b.instruction ?? null,
                questions: (b.questions ?? []).map((q) => ({
                  questionId: q.question_id,
                  number: numberOf(q.question_id),
                  stem: q.stem,
                  options: q.options.map(pick),
                })),
              },
            ];
          if (b.type === "matching")
            return [
              {
                kind: "matching",
                instruction: b.instruction ?? null,
                options: (b.options ?? []).map(pick),
                items: (b.items ?? []).map((it) => ({
                  questionId: it.question_id,
                  number: numberOf(it.question_id),
                  text: it.text,
                })),
              },
            ];
          return [];
        }),
      };
    }),
  };
}

/** 完整考卷的「舊式」題目卷欄位用空的（畫面改看 fullPaper） */
export const EMPTY_PAPER_VIEW: PaperView = { title: "", instruction: null, sections: [] };

/** 題目卷 → 考試頁要的兩種畫法：2.x 的 paper，或完整考卷的 fullPaper */
export function toSheetPapers(paper: JsonObject): {
  paper: PaperView;
  fullPaper: FullPaperView | null;
} {
  const fullPaper = toFullPaperView(paper);
  return fullPaper
    ? { paper: EMPTY_PAPER_VIEW, fullPaper }
    : { paper: toPaperView(paper), fullPaper: null };
}
