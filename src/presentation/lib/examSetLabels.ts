import type { ExamAccess } from "@/domain/examSet/examSet";

/**
 * 題組相關的代碼 → 畫面上的說法。文字在翻譯檔 examSet.*（messages/<語言>.json），
 * 給老師看的說法，不用技術用語。翻譯檔沒列到的值就照原樣顯示。
 */

/** 選項排列順序：下架 → 上架 → 公開 */
export const ACCESS_ORDER: readonly ExamAccess[] = ["unlisted", "members", "public"];

type Translate = ((key: string) => string) & { has: (key: string) => boolean };

export type ExamSetLabelKind =
  "trap" | "answerPolicy" | "answerType" | "aiRuling" | "severity" | "category";

/** 例如 examSetLabel(t, "trap", "spelling") → 「拼字（錄音逐字母唸）」；null 顯示「—」 */
export function examSetLabel(t: Translate, kind: ExamSetLabelKind, value: string | null) {
  if (value === null) return "—";
  const key = `examSet.${kind}.${value}`;
  return t.has(key) ? t(key) : value;
}
