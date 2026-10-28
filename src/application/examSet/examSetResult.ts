import type { AiVerdict } from "@/domain/examSet/examSet";
import type { BundleProblem, TranscriptProblem } from "@/domain/examSet/bundle";
import type { AnswerKeyProblem } from "./answerKey";

/** 上傳失敗的原因（代碼；文字在翻譯檔 errors.upload.*） */
export type UploadProblem =
  | BundleProblem
  | TranscriptProblem
  | AnswerKeyProblem
  | { code: "notLoggedIn" }
  | { code: "forbidden" }
  | { code: "missingFiles" }
  | { code: "invalidJson" }
  | { code: "schemaField"; path: string; message: string }
  | { code: "duplicate"; setId: string };

export type UploadExamSetResult =
  | { ok: true; setId: string; title: string; aiVerdict: AiVerdict }
  | { ok: false; problems: UploadProblem[] };
