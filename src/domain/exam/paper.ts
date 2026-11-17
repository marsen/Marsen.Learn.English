import type { JsonObject } from "@/domain/examSet/examSet";

/** 2.x 題目卷（form_table）裡所有空格的題號（照出現順序） */
function formBlanks(paper: unknown): string[] {
  const p = (paper ?? {}) as JsonObject;
  const rows = Array.isArray(p.rows) ? p.rows : [];
  const ids: string[] = [];
  for (const row of rows) {
    const parts = (row as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const blank = (part as { blank?: unknown }).blank;
      if (typeof blank === "string") ids.push(blank);
    }
  }
  return ids;
}

/** 完整考卷一個區塊裡的題號：form 的空格、choice 的題目、matching 的項目 */
function blockQuestions(block: unknown): string[] {
  const b = (block ?? {}) as JsonObject;
  const idsOf = (list: unknown) =>
    Array.isArray(list)
      ? list.flatMap((q) => {
          const id = (q as { question_id?: unknown } | null)?.question_id;
          return typeof id === "string" ? [id] : [];
        })
      : [];
  if (b.type === "form") return formBlanks(b.form);
  if (b.type === "choice") return idsOf(b.questions);
  if (b.type === "matching") return idsOf(b.items);
  return [];
}

/**
 * 題目卷上所有要作答的題號（照出現順序）。題目卷是考生看得到的部分，沒有答案。
 * 2.x 是 form_table 的空格；完整考卷（有 sections）逐段、逐區塊收。
 */
export function blanksOf(paper: JsonObject): string[] {
  if (Array.isArray(paper.sections)) {
    return paper.sections.flatMap((s) => {
      const blocks = (s as { blocks?: unknown } | null)?.blocks;
      return Array.isArray(blocks) ? blocks.flatMap(blockQuestions) : [];
    });
  }
  return formBlanks(paper);
}
