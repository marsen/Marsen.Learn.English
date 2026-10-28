import type { AiVerdict, PublicTiming, TimingEvent, Transcript } from "./examSet";

/**
 * 打包檔（set.json）的規則：支援的版本、錄音完整性、時間軸去敏。
 * 不檢查題目品質（那是出題工具和老師審稿的事）。
 */
/**
 * 版本＝大版號 schema_version ＋ 小版號 schema_minor（沒有就是 0）。
 * - 大版號：不相容的改動才升，網站只收 SUPPORTED_SCHEMA_VERSION（2 起 provenance.ai_review 帶 findings）
 * - 小版號：相容的改動（加欄位）才升，網站全收；新欄位一律當作可有可無
 *   - 2.1：加 transcript（逐字稿與每題答案的出處）
 * 舊的打包檔在 Question.Generator 重新跑 bundle 即可。
 */
export const SUPPORTED_SCHEMA_VERSION = 2;

/** 小於這個大小的錄音檔視為壞檔 */
export const MIN_AUDIO_BYTES = 10_000;

export type BundleAudioInfo = { bytes: number; sha256: string };

export type BundleFacts = {
  schemaVersion: unknown;
  declaredAudio: BundleAudioInfo;
  actualAudio: BundleAudioInfo;
  validateOk: boolean;
  aiVerdict: unknown;
};

/** 不能上傳的原因（代碼；文字在翻譯檔 errors.upload.*） */
export type BundleProblem =
  | { code: "unsupportedSchema"; version: string; supported: number }
  | { code: "audioTooSmall" }
  | { code: "audioMismatch" }
  | { code: "generatorValidationFailed" }
  | { code: "missingAiVerdict" };

/** 回傳所有不能上傳的原因；空陣列代表可以上傳 */
export function bundleProblems(f: BundleFacts): BundleProblem[] {
  const problems: BundleProblem[] = [];
  if (f.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    problems.push({
      code: "unsupportedSchema",
      version: String(f.schemaVersion),
      supported: SUPPORTED_SCHEMA_VERSION,
    });
  }
  if (f.actualAudio.bytes < MIN_AUDIO_BYTES) problems.push({ code: "audioTooSmall" });
  if (
    f.actualAudio.bytes !== f.declaredAudio.bytes ||
    f.actualAudio.sha256 !== f.declaredAudio.sha256
  ) {
    problems.push({ code: "audioMismatch" });
  }
  if (!f.validateOk) problems.push({ code: "generatorValidationFailed" });
  if (!isAiVerdict(f.aiVerdict)) problems.push({ code: "missingAiVerdict" });
  return problems;
}

export function isAiVerdict(v: unknown): v is AiVerdict {
  return v === "pass" || v === "needs_human";
}

const TIMING_FIELDS = [
  "type",
  "id",
  "start",
  "end",
  "questions",
  "seconds",
  "group",
] as const;

/** 時間軸去敏：只留播放需要的欄位（逐字稿文字、說話者一律拿掉） */
export function toPublicTiming(raw: {
  total_seconds: number;
  events: Record<string, unknown>[];
}): PublicTiming {
  return {
    totalSeconds: raw.total_seconds,
    events: raw.events.map((e) => {
      const kept: Record<string, unknown> = {};
      for (const k of TIMING_FIELDS) if (e[k] !== undefined) kept[k] = e[k];
      return kept as TimingEvent;
    }),
  };
}

/** 音檔在儲存空間的位置：帶雜湊前 8 碼，重傳不同錄音不會蓋掉舊檔 */
export function audioKeyFor(setId: string, sha256: string): string {
  return `${setId}/audio-${sha256.slice(0, 8)}.mp3`;
}

/**
 * 逐字稿要跟時間軸、答案卡對得上，不然審稿頁的「從答案那句開始聽」會跳錯地方。
 * 回傳所有問題；空陣列代表沒問題。
 */
export type TranscriptProblem =
  | { code: "transcriptTimingMismatch" }
  | { code: "evidenceUnknownQuestion"; questionId: string }
  | { code: "evidenceUnknownTurn"; questionId: string; turn: string }
  | { code: "evidenceMissing"; questionId: string };

export function transcriptProblems(
  t: Transcript,
  timingTurnIds: readonly string[],
  questionIds: readonly string[],
): TranscriptProblem[] {
  const problems: TranscriptProblem[] = [];
  const turnIds = t.turns.map((x) => x.id);
  if (
    turnIds.length !== timingTurnIds.length ||
    turnIds.some((id, i) => id !== timingTurnIds[i])
  ) {
    problems.push({ code: "transcriptTimingMismatch" });
  }
  for (const e of t.evidence) {
    if (!questionIds.includes(e.questionId))
      problems.push({ code: "evidenceUnknownQuestion", questionId: e.questionId });
    if (!turnIds.includes(e.turn))
      problems.push({
        code: "evidenceUnknownTurn",
        questionId: e.questionId,
        turn: e.turn,
      });
  }
  for (const q of questionIds) {
    if (!t.evidence.some((e) => e.questionId === q))
      problems.push({ code: "evidenceMissing", questionId: q });
  }
  return problems;
}
