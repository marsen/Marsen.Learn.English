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
  | { code: "schemaField"; path: string; message: string };

/** 上傳成功的結果：新上傳、覆蓋（當成新上傳：待審、下架） */
export type UploadOutcome = "created" | "replaced";

/** 同一個 set_id 已經有了（還沒說要覆蓋） */
export type ExistingSet = { setId: string; title: string };

export type UploadExamSetResult =
  | {
      ok: true;
      setId: string;
      title: string;
      aiVerdict: AiVerdict;
      outcome: UploadOutcome;
    }
  | { ok: false; problems: UploadProblem[]; existing?: ExistingSet };
