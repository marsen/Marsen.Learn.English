import { z } from "zod";
import { ANSWER_POLICIES, type AnswerKeyEntry } from "@/domain/exam/grading";
import { toPaperView, type PaperView } from "./paperView";

/**
 * 首頁「先試做一題」：從一套題組剪下來的幾題（scripts/make-landing-demo.mjs 產生）。
 * 這是公開的示意題，答案和逐字稿本來就要給路人看，不用藏。
 */
export type LandingDemoView = {
  audioUrl: string;
  /** 錄音秒數（進度條用） */
  duration: number;
  paper: PaperView;
  answers: (Omit<AnswerKeyEntry, "questionId"> & {
    questionId: string;
    /** 題號（從 1 開始，跟題目卷上的圓圈一樣） */
    number: number;
    trap: string;
  })[];
  transcript: { id: string; speaker: string; text: string; start: number }[];
  /** 每題答案出自哪一句（turn 對應 transcript 的 id） */
  evidence: { questionId: string; turn: string; quote: string }[];
};

const schema = z.object({
  duration: z.number(),
  paper: z.record(z.string(), z.unknown()),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
      accepted: z.array(z.string()),
      policy: z.enum(ANSWER_POLICIES),
      trap: z.string(),
    }),
  ),
  transcript: z.array(
    z.object({
      id: z.string(),
      speaker: z.string(),
      text: z.string(),
      start: z.number(),
    }),
  ),
  evidence: z.array(
    z.object({ questionId: z.string(), turn: z.string(), quote: z.string() }),
  ),
});

/** 示意題資料（landingDemo.json）→ 畫面要的樣子；格式不對直接丟錯（建置時就會發現） */
export function toLandingDemoView(raw: unknown, audioUrl: string): LandingDemoView {
  const d = schema.parse(raw);
  const paper = toPaperView(d.paper);
  const numbers = new Map(
    paper.sections
      .flatMap((s) => s.rows.flatMap((r) => r.parts))
      .flatMap((p) => (p.kind === "blank" ? [[p.questionId, p.number] as const] : [])),
  );
  return {
    audioUrl,
    duration: d.duration,
    paper,
    answers: d.answers.map((a) => ({ ...a, number: numbers.get(a.questionId) ?? 0 })),
    transcript: d.transcript,
    evidence: d.evidence,
  };
}
