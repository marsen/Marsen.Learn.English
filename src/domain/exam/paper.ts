import type { JsonObject } from "@/domain/examSet/examSet";

/** 從題目卷找出所有空格的題號（照出現順序）。題目卷是考生看得到的部分，沒有答案。 */
export function blanksOf(paper: JsonObject): string[] {
  const rows = Array.isArray(paper.rows) ? paper.rows : [];
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
