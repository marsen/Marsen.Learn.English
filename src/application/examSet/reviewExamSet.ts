import { z } from "zod";
import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import {
  cleanAiActions,
  cleanNote,
  cleanNotes,
  isReviewDecision,
  reviewProblems,
  type ReviewProblem,
} from "@/domain/examSet/review";
import { buildReviewView } from "./reviewView";

/** 審稿送不出去的原因（代碼）；畫面再轉成使用者的語言 */
export type ReviewError =
  | ReviewProblem
  | { code: "forbidden" }
  | { code: "setNotFound" }
  | { code: "badPayload" };

export type ReviewExamSetResult = { ok: true } | { ok: false; problems: ReviewError[] };

export type ReviewInput = {
  decision: unknown;
  comment?: string | null;
  /** 老師的意見；target 是題號，null＝整套／錄音 */
  notes?: { target: string | null; text: string }[];
  /** 老師對 AI 意見的處理（保留的不用送） */
  aiActions?: { ref: string; action: "edited" | "deleted"; text: string | null }[];
};

const payloadSchema = z.object({
  notes: z.array(z.object({ target: z.string().nullable(), text: z.string() })),
  aiActions: z.array(
    z.object({
      ref: z.string(),
      action: z.enum(["edited", "deleted"]),
      text: z.string().nullable(),
    }),
  ),
});

/** 審稿頁送來的意見（JSON 字串）；格式不對回傳 null */
export function parseReviewPayload(
  json: string | null,
): Pick<Required<ReviewInput>, "notes" | "aiActions"> | null {
  if (!json) return null;
  try {
    const r = payloadSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * 老師審稿：判定合格／不合格，可附整體意見、每題或整套的意見，並保留、改寫或刪除 AI 的意見。
 * 可以重複審稿，以最後一次為準。題組狀態跟著判定改。
 */
export class ReviewExamSet {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: ReviewInput & { actor: Account; setId: string },
  ): Promise<ReviewExamSetResult> {
    if (!can(input.actor.roles, "reviewSets")) {
      return { ok: false, problems: [{ code: "forbidden" }] };
    }
    const [set, secret] = await Promise.all([
      this.sets.findById(input.setId),
      this.sets.findPrivate(input.setId),
    ]);
    if (!set || !secret) return { ok: false, problems: [{ code: "setNotFound" }] };

    const comment = cleanNote(input.comment);
    const notes = cleanNotes(input.notes ?? []);
    const aiActions = cleanAiActions(input.aiActions ?? []);
    const view = buildReviewView(set, secret, null);
    const problems = reviewProblems({
      decision: input.decision,
      comment,
      notes,
      aiActions,
      knownQuestionIds: view.questions.map((q) => q.questionId),
      knownAiRefs: view.aiNotes.map((n) => n.ref),
    });
    if (problems.length > 0 || !isReviewDecision(input.decision))
      return { ok: false, problems };

    await this.sets.saveReview({
      setId: input.setId,
      reviewerId: input.actor.id,
      decision: input.decision,
      comment,
      notes,
      aiActions,
      reviewedAt: this.now(),
    });
    return { ok: true };
  }
}
