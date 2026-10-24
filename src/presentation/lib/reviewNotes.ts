/**
 * 批註卡縮成小標籤時要顯示的摘要：幾則 AI、幾則老師、刪掉幾則、最嚴重的程度。
 */

export type Severity = "info" | "warn" | "block";

const RANK: Record<Severity, number> = { info: 1, warn: 2, block: 3 };

/**
 * AI 意見的嚴重程度：AI 審稿的發現照它自己標的（info／warn／block）；
 * 程式示警沒有標，AI 判定是誤報（ok）算提醒，其他（真問題或沒判）算注意。
 */
export function aiSeverity(n: {
  kind: "warning" | "finding";
  severity: string | null;
  aiRuling: string | null;
}): Severity {
  if (n.kind === "warning") return n.aiRuling === "ok" ? "info" : "warn";
  return n.severity === "block" || n.severity === "warn" ? n.severity : "info";
}

export type ChipSummary = {
  ai: number;
  teacher: number;
  deleted: number;
  /** 還在的 AI 意見裡最嚴重的；沒有 AI 意見是 null */
  worst: Severity | null;
};

export function chipSummary(
  aiNotes: readonly { severity: Severity; deleted: boolean }[],
  teacherNotes: number,
): ChipSummary {
  const kept = aiNotes.filter((n) => !n.deleted);
  let worst: Severity | null = null;
  for (const n of kept) if (!worst || RANK[n.severity] > RANK[worst]) worst = n.severity;
  return {
    ai: kept.length,
    teacher: teacherNotes,
    deleted: aiNotes.length - kept.length,
    worst,
  };
}
