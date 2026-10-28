import { z } from "zod";
import type { JsonObject } from "@/domain/examSet/examSet";
import { ANSWER_POLICIES, type AnswerKeyEntry } from "@/domain/exam/grading";

const text = z.union([z.string(), z.number()]).transform(String);

const schema = z.object({
  answers: z
    .array(
      z
        .object({
          question_id: z.string(),
          answer: text,
          accepted: z.array(text).nullish(),
          answer_policy: z.enum(ANSWER_POLICIES),
        })
        .loose(),
    )
    .min(1),
});

/** 答案卡格式不對：哪個欄位、Zod 的說明（英文） */
export type AnswerKeyProblem = { code: "answerKeyField"; path: string; message: string };

export type ParseAnswerKeyResult =
  { ok: true; entries: AnswerKeyEntry[] } | { ok: false; problems: AnswerKeyProblem[] };

/** 從 set.json 的答案卡（answers）取出批改要用的標準答案；格式不對（含不認得的答案規則）回傳原因 */
export function parseAnswerKey(answers: JsonObject): ParseAnswerKeyResult {
  const r = schema.safeParse(answers);
  if (!r.success) {
    return {
      ok: false,
      problems: r.error.issues.map((i) => ({
        code: "answerKeyField" as const,
        path: `answers.${i.path.join(".")}`,
        message: i.message,
      })),
    };
  }
  return {
    ok: true,
    entries: r.data.answers.map((a) => ({
      questionId: a.question_id,
      answer: a.answer,
      accepted: a.accepted ?? [],
      policy: a.answer_policy,
    })),
  };
}
