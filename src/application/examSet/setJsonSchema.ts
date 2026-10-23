import { z } from "zod";

/**
 * set.json 的外型檢查（只驗這一層要用到的欄位；題目卷、答案卡原樣保存）。
 * 格式說明見 Question.Generator 的 README「set.json 怎麼讀」。
 */
const jsonObject = z.record(z.string(), z.unknown());

export const setJsonSchema = z.object({
  schema_version: z.unknown(),
  /** 小版號（2.1 起才有）；相容的改動才升，不影響能不能上傳 */
  schema_minor: z.number().int().nonnegative().optional(),
  set_id: z.string().regex(/^[a-z0-9-]+$/, "set_id 只能有小寫英數與 -"),
  title: z.string().min(1),
  topic: z.string().min(1),
  question_count: z.number().int().positive(),
  paper: jsonObject,
  answers: jsonObject,
  timing: z.object({
    total_seconds: z.number(),
    events: z.array(jsonObject),
  }),
  audio: z.object({
    bytes: z.number().int(),
    sha256: z.string(),
  }),
  /** 逐字稿與每題答案的出處（2.1 起）；只存在私密部分 */
  transcript: z
    .object({
      turns: z.array(
        z.object({ id: z.string(), speaker: z.string(), text: z.string() }).loose(),
      ),
      evidence: z.array(
        z
          .object({ question_id: z.string(), turn: z.string(), quote: z.string() })
          .loose(),
      ),
    })
    .loose()
    .optional(),
  provenance: z
    .object({
      validate: z.object({ ok: z.boolean() }).partial().loose().optional(),
      ai_review: z.object({ verdict: z.unknown() }).partial().loose().nullish(),
    })
    .loose(),
});

export type SetJson = z.infer<typeof setJsonSchema>;
