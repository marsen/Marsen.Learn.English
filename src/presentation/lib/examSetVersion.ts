import type { ExamSetSummary } from "@/domain/examSet/examSetFilter";

type Version = Pick<ExamSetSummary, "schemaVersion" | "schemaMinor">;

/** 題組列表的版本欄：大版號.小版號（例如 2.1、3.0） */
export function versionLabel(s: Version): string {
  return `${s.schemaVersion}.${s.schemaMinor}`;
}

/** 版本提示用哪一句（翻譯檔 sets.versionHint.*）：完整考卷、有逐字稿、沒有逐字稿 */
export function versionHintOf(s: Version): "fullExam" | "transcript" | "noTranscript" {
  if (s.schemaVersion >= 3) return "fullExam";
  return s.schemaMinor > 0 ? "transcript" : "noTranscript";
}
