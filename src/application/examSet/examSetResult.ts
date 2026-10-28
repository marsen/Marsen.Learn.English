import type { AiVerdict } from "@/domain/examSet/examSet";
import type { BundleProblem, TranscriptProblem } from "@/domain/examSet/bundle";
import type { OverwriteCheck } from "@/domain/examSet/overwrite";
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

/** 上傳成功的結果：新建、覆蓋時只補資料、覆蓋時整套換掉（退回待審）、跟網站上一樣所以沒動 */
export type UploadOutcome = "created" | "supplemented" | "replaced" | "unchanged";

/** 同一個 set_id 已經有了（還沒說要覆蓋）：網站上那份的標題，以及覆蓋會怎樣 */
export type ExistingSet = OverwriteCheck & { setId: string; title: string };

export type UploadExamSetResult =
  | {
      ok: true;
      setId: string;
      title: string;
      aiVerdict: AiVerdict;
      outcome: UploadOutcome;
    }
  | { ok: false; problems: UploadProblem[]; existing?: ExistingSet };
