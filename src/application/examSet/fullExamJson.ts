import { z } from "zod";
import type { JsonObject } from "@/domain/examSet/examSet";
import { setJsonSchema, type SetJson } from "./setJsonSchema";

/**
 * 完整考卷（set.json 3.0，四個 section 合成一份）的外型檢查與轉換。
 * 格式見 Question.Generator 的 schema/exam.schema.json。
 * 轉成和 2.x 一樣的存法（不改資料庫結構），細節見 docs/282-…/designs/design-full-exam.md：
 * - 題目卷：{ sections: [{ ielts_section, title, topic, first_question, last_question, blocks }] }
 * - 答案卡：四段的 answers 接成一個陣列（每筆帶 ielts_section）
 * - 逐字稿：四段接起來（id 本來就有 s<n>- 前綴）
 * - 製作紀錄：validate／ai_review／warnings 合起來，原本每段的放在 sections
 */
const jsonObject = z.record(z.string(), z.unknown());
const option = z.object({ key: z.string().regex(/^[A-Z]$/), text: z.string() }).loose();

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("form"), form: jsonObject }).loose(),
  z
    .object({
      type: z.literal("choice"),
      instruction: z.string().nullish(),
      questions: z
        .array(
          z
            .object({
              question_id: z.string(),
              stem: z.string(),
              options: z.array(option).length(3),
            })
            .loose(),
        )
        .min(1),
    })
    .loose(),
  z
    .object({
      type: z.literal("matching"),
      instruction: z.string().nullish(),
      options: z.array(option),
      items: z
        .array(z.object({ question_id: z.string(), text: z.string() }).loose())
        .min(1),
    })
    .loose()
    .refine((b) => b.options.length >= b.items.length + 2, {
      message: "matching: options must be at least items + 2",
    }),
]);

const section = z
  .object({
    ielts_section: z.number().int().min(1).max(4),
    source_set_id: z.string().nullish(),
    topic: z.string().min(1),
    title: z.string().min(1),
    first_question: z.number().int().positive(),
    last_question: z.number().int().positive(),
    paper: z.object({ blocks: z.array(block).min(1) }).loose(),
    answers: z.object({ answers: z.array(jsonObject) }).loose(),
    transcript: z
      .object({ turns: z.array(jsonObject), evidence: z.array(jsonObject) })
      .loose()
      .nullish(),
    provenance: jsonObject,
  })
  .loose();

export const fullExamJsonSchema = z
  .object({
    schema_version: z.literal(3),
    schema_minor: z.number().int().nonnegative().optional(),
    set_id: z
      .string()
      .regex(/^[a-z0-9-]+$/, "set_id: lowercase letters, digits and - only"),
    title: z.string().min(1),
    question_count: z.number().int().positive(),
    sections: z.array(section).min(1).max(4),
    timing: z.object({ total_seconds: z.number(), events: z.array(jsonObject) }).loose(),
    audio: z.object({ bytes: z.number().int(), sha256: z.string() }).loose(),
    ai_review_verdict: z.unknown(),
  })
  .loose();

type FullExamJson = z.infer<typeof fullExamJsonSchema>;

export type FullExamProblem = { code: "schemaField"; path: string; message: string };

export type ParseFullExamResult =
  { ok: true; bundle: SetJson } | { ok: false; problems: FullExamProblem[] };

const field = (path: string, message: string): FullExamProblem => ({
  code: "schemaField",
  path,
  message,
});

/** 結構以外的規則：段落不重複、題號全卷唯一、單選配對的答案是選項裡的字母 */
function ruleProblems(b: FullExamJson): FullExamProblem[] {
  const problems: FullExamProblem[] = [];
  const seenSections = new Set<number>();
  const seenQuestions = new Set<string>();
  b.sections.forEach((s, i) => {
    if (seenSections.has(s.ielts_section))
      problems.push(field(`sections.${i}.ielts_section`, "duplicate section"));
    seenSections.add(s.ielts_section);
    // 每題可以填的字母（單選、配對）
    const lettersOf = new Map<string, string[]>();
    for (const blk of s.paper.blocks) {
      if (blk.type === "choice")
        for (const q of blk.questions)
          lettersOf.set(
            q.question_id,
            q.options.map((o) => o.key),
          );
      if (blk.type === "matching")
        for (const it of blk.items)
          lettersOf.set(
            it.question_id,
            blk.options.map((o) => o.key),
          );
    }
    s.answers.answers.forEach((a, j) => {
      const id = String(a.question_id);
      if (seenQuestions.has(id))
        problems.push(field(`sections.${i}.answers.answers.${j}`, `duplicate ${id}`));
      seenQuestions.add(id);
      const letters = lettersOf.get(id);
      if (letters && !letters.includes(String(a.answer)))
        problems.push(
          field(`sections.${i}.answers.answers.${j}.answer`, `not an option of ${id}`),
        );
    });
  });
  return problems;
}

/** 解析 3.0；通過就轉成和 2.x 一樣的形狀，交給原本的上傳檢查 */
export function parseFullExam(raw: unknown): ParseFullExamResult {
  const parsed = fullExamJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => field(i.path.join("."), i.message)),
    };
  }
  const b = parsed.data;
  const problems = ruleProblems(b);
  if (problems.length > 0) return { ok: false, problems };

  const sections = [...b.sections].sort((x, y) => x.ielts_section - y.ielts_section);
  const provOf = (s: (typeof sections)[number]) => s.provenance as JsonObject;
  const aiOf = (s: (typeof sections)[number]) =>
    (provOf(s).ai_review ?? {}) as { findings?: unknown };
  const tag = (list: unknown, n: number, prefixId: boolean) =>
    (Array.isArray(list) ? list : []).map((x) => {
      const o: JsonObject = { ...(x as JsonObject), ielts_section: n };
      if (prefixId && o.id !== undefined) o.id = `s${n}-${String(o.id)}`;
      return o;
    });

  const converted = {
    schema_version: 3,
    schema_minor: b.schema_minor ?? 0,
    set_id: b.set_id,
    title: b.title,
    topic: sections[0].topic,
    question_count: b.question_count,
    paper: {
      sections: sections.map((s) => ({
        ielts_section: s.ielts_section,
        title: s.title,
        topic: s.topic,
        first_question: s.first_question,
        last_question: s.last_question,
        blocks: s.paper.blocks,
      })),
    },
    answers: {
      answers: sections.flatMap((s) =>
        s.answers.answers.map((a) => ({ ...a, ielts_section: s.ielts_section })),
      ),
    },
    timing: b.timing,
    audio: b.audio,
    transcript: sections.every((s) => s.transcript)
      ? {
          turns: sections.flatMap((s) => s.transcript?.turns ?? []),
          evidence: sections.flatMap((s) => s.transcript?.evidence ?? []),
        }
      : undefined,
    provenance: {
      validate: {
        ok: sections.every(
          (s) => (provOf(s).validate as { ok?: unknown } | undefined)?.ok === true,
        ),
      },
      ai_review: {
        verdict: b.ai_review_verdict,
        findings: sections.flatMap((s) => tag(aiOf(s).findings, s.ielts_section, false)),
      },
      warnings: sections.flatMap((s) => tag(provOf(s).warnings, s.ielts_section, true)),
      // 每段的製作紀錄原樣留著；旁白（answers.cast）也放這裡，審稿頁給管理員看用
      sections: sections.map((s) => ({
        ielts_section: s.ielts_section,
        ...provOf(s),
        ...(s.answers.cast !== undefined ? { cast: s.answers.cast } : {}),
      })),
    },
  };
  // 轉好的內容再用 2.x 的外型檢查一次（逐字稿每句的欄位等）
  const again = setJsonSchema.safeParse(converted);
  if (!again.success) {
    return {
      ok: false,
      problems: again.error.issues.map((i) => field(i.path.join("."), i.message)),
    };
  }
  return { ok: true, bundle: again.data };
}
