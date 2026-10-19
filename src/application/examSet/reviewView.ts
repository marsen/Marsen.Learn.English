import { z } from "zod";
import type { ExamSet, ExamSetPrivate, JsonObject } from "@/domain/examSet/examSet";
import type { TeacherReview } from "@/domain/examSet/review";

/** 審稿頁要看的一小題：題目位置、標準答案、可接受寫法、陷阱…… */
export type ReviewQuestion = {
  questionId: string;
  /** 題目卷上的欄位名稱，例如 Address */
  label: string | null;
  section: string | null;
  answer: string;
  accepted: string[];
  answerType: string | null;
  trap: string | null;
  answerPolicy: string | null;
  wrongValue: string | null;
  note: string | null;
};

/** 出題流程的示警（含 AI 的裁決） */
export type ReviewWarning = {
  id: string;
  questionId: string | null;
  message: string;
  aiRuling: string | null;
};

export type ReviewView = {
  set: ExamSet;
  instruction: string | null;
  questions: ReviewQuestion[];
  warnings: ReviewWarning[];
  review: TeacherReview | null;
};

const str = z.string();
const optStr = z.string().nullish();

const answerCardSchema = z.object({
  answers: z.array(
    z
      .object({
        question_id: str,
        answer: z.union([str, z.number()]).transform(String),
        accepted: z.array(z.union([str, z.number()]).transform(String)).nullish(),
        type: optStr,
        trap: optStr,
        answer_policy: optStr,
        wrong_value: z.union([str, z.number()]).transform(String).nullish(),
        note: optStr,
      })
      .loose(),
  ),
});

const warningsSchema = z
  .array(
    z
      .object({
        id: z.union([str, z.number()]).transform(String),
        question_id: optStr,
        message: str,
        ai_ruling: optStr,
      })
      .loose(),
  )
  .catch([]);

const paperSchema = z
  .object({
    instruction: optStr,
    rows: z
      .array(
        z
          .object({
            label: optStr,
            section: optStr,
            parts: z.array(z.object({ blank: optStr }).loose()).nullish(),
          })
          .loose(),
      )
      .catch([]),
  })
  .loose();

/** 把 set.json 原樣保存的 JSON 整理成審稿頁要的樣子（格式不對就丟錯，交給呼叫端） */
export function buildReviewView(
  set: ExamSet,
  secret: ExamSetPrivate,
  review: TeacherReview | null,
): ReviewView {
  const paper = paperSchema.parse(set.paper);
  const card = answerCardSchema.parse(secret.answers);
  const where = new Map<string, { label: string | null; section: string | null }>();
  for (const row of paper.rows) {
    for (const part of row.parts ?? []) {
      if (part.blank)
        where.set(part.blank, { label: row.label ?? null, section: row.section ?? null });
    }
  }
  return {
    set,
    instruction: paper.instruction ?? null,
    questions: card.answers.map((a) => ({
      questionId: a.question_id,
      label: where.get(a.question_id)?.label ?? null,
      section: where.get(a.question_id)?.section ?? null,
      answer: a.answer,
      accepted: a.accepted ?? [],
      answerType: a.type ?? null,
      trap: a.trap ?? null,
      answerPolicy: a.answer_policy ?? null,
      wrongValue: a.wrong_value ?? null,
      note: a.note ?? null,
    })),
    warnings: warningsSchema
      .parse((secret.provenance as JsonObject).warnings ?? [])
      .map((w) => ({
        id: w.id,
        questionId: w.question_id ?? null,
        message: w.message,
        aiRuling: w.ai_ruling ?? null,
      })),
    review,
  };
}
