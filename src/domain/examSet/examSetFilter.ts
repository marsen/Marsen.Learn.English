import type { AiVerdict, ExamAccess, ExamSet, ExamSetStatus } from "./examSet";

/** 題組清單一列要用的欄位（不含題目卷、時間軸這些大塊 JSON） */
export type ExamSetSummary = Pick<
  ExamSet,
  | "setId"
  | "title"
  | "topic"
  | "questionCount"
  | "aiVerdict"
  | "schemaMinor"
  | "status"
  | "access"
  | "uploadedAt"
>;

/** 題組清單的過濾條件；沒給的條件就不過濾 */
export type ExamSetFilter = {
  status?: ExamSetStatus;
  aiVerdict?: AiVerdict;
  access?: ExamAccess;
  /** 比對題組代號、標題、主題（不分大小寫、部分符合） */
  keyword?: string;
};

export function isFilterEmpty(f: ExamSetFilter): boolean {
  return !f.status && !f.aiVerdict && !f.access && !f.keyword;
}

/** 一套題符不符合條件（記憶體版 repository 與測試用；資料庫版在 SQL 裡做同樣的事） */
export function matchesFilter(s: ExamSetSummary, f: ExamSetFilter): boolean {
  if (f.status && s.status !== f.status) return false;
  if (f.aiVerdict && s.aiVerdict !== f.aiVerdict) return false;
  if (f.access && s.access !== f.access) return false;
  if (f.keyword) {
    const k = f.keyword.toLowerCase();
    return [s.setId, s.title, s.topic].some((v) => v.toLowerCase().includes(k));
  }
  return true;
}
