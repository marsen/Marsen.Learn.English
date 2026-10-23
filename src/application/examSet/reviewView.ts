import { z } from "zod";
import type { ExamSet, ExamSetPrivate, JsonObject } from "@/domain/examSet/examSet";
import { aiNoteRef, type TeacherReview } from "@/domain/examSet/review";
import { toPaperView, type PaperView } from "@/application/exam/paperView";

/** 一題答案在錄音裡的出處（set.json 2.1 起才有） */
export type ReviewEvidence = {
  turn: string;
  quote: string;
  /** 這一句開始的秒數；時間軸找不到就是 null */
  start: number | null;
  /** 這一題的答案講完的秒數（下一句開始）；找不到就是 null */
  end: number | null;
};

/** 審稿頁要看的一小題：題目位置、標準答案、可接受寫法、陷阱、出處…… */
export type ReviewQuestion = {
  questionId: string;
  /** 題號（題目卷上的順序，從 1 開始） */
  number: number;
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
  evidence: ReviewEvidence | null;
};

/**
 * AI 的意見：出題程式的示警（附 AI 的裁決），或 AI 審稿的其他發現。
 * questionId 是 null 的屬於整套。ref 是固定的代號，老師的處理用它對回來。
 */
export type AiNote = {
  ref: string;
  kind: "warning" | "finding";
  questionId: string | null;
  message: string;
  suggestion: string | null;
  /** 示警：編號、來源規則、AI 的裁決（ok＝誤報、problem＝真問題） */
  warningId: string | null;
  rule: string | null;
  aiRuling: string | null;
  /** 發現：分類、嚴重度 */
  category: string | null;
  severity: string | null;
};

/** 逐字稿的一句，附開始的秒數 */
export type ReviewTurn = {
  id: string;
  speaker: string;
  text: string;
  start: number | null;
};

export type ReviewView = {
  set: ExamSet;
  paper: PaperView;
  questions: ReviewQuestion[];
  aiNotes: AiNote[];
  /** 逐字稿；2.1 以前打包的題組沒有，是 null */
  turns: ReviewTurn[] | null;
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

const findingsSchema = z
  .object({
    ai_review: z
      .object({
        findings: z
          .array(
            z
              .object({
                question_id: optStr,
                category: optStr,
                severity: str,
                message: str,
                suggestion: optStr,
              })
              .loose(),
          )
          .catch([]),
      })
      .loose()
      .nullish(),
  })
  .loose();

const warningsSchema = z
  .array(
    z
      .object({
        id: z.union([str, z.number()]).transform(String),
        source: optStr,
        rule: optStr,
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
  const paperRows = paperSchema.parse(set.paper);
  const paper = toPaperView(set.paper);
  const card = answerCardSchema.parse(secret.answers);
  const where = new Map<string, { label: string | null; section: string | null }>();
  for (const row of paperRows.rows) {
    for (const part of row.parts ?? []) {
      if (part.blank)
        where.set(part.blank, { label: row.label ?? null, section: row.section ?? null });
    }
  }
  const numberOf = new Map<string, number>();
  for (const section of paper.sections)
    for (const row of section.rows)
      for (const part of row.parts)
        if (part.kind === "blank") numberOf.set(part.questionId, part.number);

  // 每一句在錄音的開始時間（時間軸 type=turn 的事件，順序就是逐字稿的順序）
  const turnEvents = set.timing.events.filter((e) => e.type === "turn");
  const startOf = new Map(
    turnEvents.flatMap((e) =>
      typeof e.id === "string" && typeof e.start === "number" ? [[e.id, e.start]] : [],
    ),
  );
  const transcript = secret.transcript;
  const turnIds = transcript?.turns.map((t) => t.id) ?? [];
  const evidenceOf = (questionId: string): ReviewEvidence | null => {
    const e = transcript?.evidence.find((x) => x.questionId === questionId);
    if (!e) return null;
    const next = turnIds[turnIds.indexOf(e.turn) + 1];
    const turnEnd = turnEvents.find((x) => x.id === e.turn)?.end;
    return {
      turn: e.turn,
      quote: e.quote,
      start: startOf.get(e.turn) ?? null,
      end:
        (next ? startOf.get(next) : undefined) ??
        (typeof turnEnd === "number" ? turnEnd : null),
    };
  };

  const warnings = warningsSchema.parse((secret.provenance as JsonObject).warnings ?? []);
  const findings = findingsSchema.parse(secret.provenance).ai_review?.findings ?? [];

  return {
    set,
    paper,
    questions: card.answers.map((a, i) => ({
      questionId: a.question_id,
      number: numberOf.get(a.question_id) ?? i + 1,
      label: where.get(a.question_id)?.label ?? null,
      section: where.get(a.question_id)?.section ?? null,
      answer: a.answer,
      accepted: a.accepted ?? [],
      answerType: a.type ?? null,
      trap: a.trap ?? null,
      answerPolicy: a.answer_policy ?? null,
      wrongValue: a.wrong_value ?? null,
      note: a.note ?? null,
      evidence: evidenceOf(a.question_id),
    })),
    aiNotes: [
      ...warnings.map((w): AiNote => ({
        ref: aiNoteRef("warning", w.id),
        kind: "warning",
        questionId: w.question_id ?? null,
        message: w.message,
        suggestion: null,
        warningId: w.id,
        rule: w.rule ?? null,
        aiRuling: w.ai_ruling ?? null,
        category: null,
        severity: null,
      })),
      ...findings.map((f, i): AiNote => ({
        ref: aiNoteRef("finding", i),
        kind: "finding",
        questionId: f.question_id ?? null,
        message: f.message,
        suggestion: f.suggestion || null,
        warningId: null,
        rule: null,
        aiRuling: null,
        category: f.category ?? null,
        severity: f.severity,
      })),
    ],
    turns:
      transcript?.turns.map((t) => ({
        id: t.id,
        speaker: t.speaker,
        text: t.text,
        start: startOf.get(t.id) ?? null,
      })) ?? null,
    review,
  };
}

/** AI 審稿提出幾個疑點（總覽用；格式不對當作 0） */
export function countAiFindings(provenance: JsonObject): number {
  return findingsSchema.parse(provenance).ai_review?.findings?.length ?? 0;
}

/** 每一題的陷阱類型（學生總覽算「最常錯的題型」用；格式不對當作沒有） */
export function trapsOf(answers: JsonObject): Map<string, string | null> {
  const parsed = answerCardSchema.safeParse(answers);
  if (!parsed.success) return new Map();
  return new Map(parsed.data.answers.map((a) => [a.question_id, a.trap ?? null]));
}
