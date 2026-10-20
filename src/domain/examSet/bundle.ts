import type { AiVerdict, PublicTiming, TimingEvent } from "./examSet";

/**
 * 打包檔（set.json）的規則：支援的版本、錄音完整性、時間軸去敏。
 * 不檢查題目品質（那是出題工具和老師審稿的事）。
 */
/** 只支援 2（2 起 provenance.ai_review 帶 findings）。舊的打包檔在 Question.Generator 重新跑 bundle 即可 */
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

/** 回傳所有不能上傳的原因；空陣列代表可以上傳 */
export function bundleProblems(f: BundleFacts): string[] {
  const problems: string[] = [];
  if (f.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    problems.push(
      `不支援的 schema_version：${String(f.schemaVersion)}（只支援 ${SUPPORTED_SCHEMA_VERSION}，請在 Question.Generator 重新打包）`,
    );
  }
  if (f.actualAudio.bytes < MIN_AUDIO_BYTES) problems.push("錄音檔太小，可能是壞的");
  if (
    f.actualAudio.bytes !== f.declaredAudio.bytes ||
    f.actualAudio.sha256 !== f.declaredAudio.sha256
  ) {
    problems.push("錄音檔和 set.json 記載的不一致（可能選錯檔，或檔案被改過）");
  }
  if (!f.validateOk) problems.push("出題工具的驗證不是通過");
  if (!isAiVerdict(f.aiVerdict))
    problems.push("缺少 AI 審稿結論（provenance.ai_review.verdict）");
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
