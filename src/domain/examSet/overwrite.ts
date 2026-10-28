import type { ExamSet, ExamSetPrivate } from "./examSet";

/**
 * 同一套題（同 set_id）重新上傳時，跟網站上那份比，差在哪裡：
 * - unchanged：完全一樣，不用覆蓋
 * - supplement：題目、答案、錄音都一樣，只多了（或改了）逐字稿、製作紀錄 → 覆蓋後審核狀態不變
 * - content：題目、答案或錄音不同 → 覆蓋後退回待審，要重新通過才上架
 */
export type OverwriteKind = "unchanged" | "supplement" | "content";

/** 會讓「內容有變」的欄位（給畫面列出差在哪裡） */
export type ContentField = "title" | "paper" | "answers" | "audio";

export type OverwriteCheck = { kind: OverwriteKind; fields: ContentField[] };

type Version = { set: ExamSet; secret: ExamSetPrivate };

/** JSON 比對：不管物件的鍵順序（資料庫 jsonb 讀回來的順序可能跟原本不同） */
export function sameJson(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export function checkOverwrite(current: Version, next: Version): OverwriteCheck {
  const fields: ContentField[] = [];
  if (current.set.title !== next.set.title || current.set.topic !== next.set.topic) {
    fields.push("title");
  }
  if (
    !sameJson(current.set.paper, next.set.paper) ||
    current.set.questionCount !== next.set.questionCount
  ) {
    fields.push("paper");
  }
  if (!sameJson(current.secret.answers, next.secret.answers)) fields.push("answers");
  // 錄音的位置帶雜湊，雜湊一樣就是同一個錄音檔；時間軸跟著錄音走
  if (
    current.set.audioKey !== next.set.audioKey ||
    !sameJson(current.set.timing, next.set.timing)
  ) {
    fields.push("audio");
  }
  if (fields.length > 0) return { kind: "content", fields };

  const supplemented =
    !sameJson(current.secret.transcript, next.secret.transcript) ||
    !sameJson(current.secret.provenance, next.secret.provenance) ||
    current.set.aiVerdict !== next.set.aiVerdict ||
    current.set.schemaMinor !== next.set.schemaMinor;
  return { kind: supplemented ? "supplement" : "unchanged", fields: [] };
}
