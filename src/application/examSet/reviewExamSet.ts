import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { cleanNote, isReviewDecision, reviewProblems } from "@/domain/examSet/review";
import { buildReviewView } from "./reviewView";

export type ReviewExamSetResult = { ok: true } | { ok: false; problems: string[] };

/**
 * 老師審稿：判定合格／不合格，可附整體意見、錄音建議、每一小題的建議。
 * 可以重複審稿，以最後一次為準。題組狀態跟著判定改。
 */
export class ReviewExamSet {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: {
    actor: Account;
    setId: string;
    decision: unknown;
    comment?: string | null;
    audioNote?: string | null;
    questionNotes?: { questionId: string; note: string | null | undefined }[];
  }): Promise<ReviewExamSetResult> {
    if (!can(input.actor.roles, "reviewSets")) {
      return { ok: false, problems: ["你的帳號沒有審稿的權限"] };
    }
    const [set, secret] = await Promise.all([
      this.sets.findById(input.setId),
      this.sets.findPrivate(input.setId),
    ]);
    if (!set || !secret) return { ok: false, problems: ["找不到這套題"] };

    const comment = cleanNote(input.comment);
    const audioNote = cleanNote(input.audioNote);
    const questionNotes = (input.questionNotes ?? []).flatMap((n) => {
      const note = cleanNote(n.note);
      return note ? [{ questionId: n.questionId, note }] : [];
    });
    const knownQuestionIds = buildReviewView(set, secret, null).questions.map(
      (q) => q.questionId,
    );
    const problems = reviewProblems({
      decision: input.decision,
      comment,
      audioNote,
      questionNotes,
      knownQuestionIds,
    });
    if (problems.length > 0 || !isReviewDecision(input.decision))
      return { ok: false, problems };

    await this.sets.saveReview({
      setId: input.setId,
      reviewerId: input.actor.id,
      decision: input.decision,
      comment,
      audioNote,
      questionNotes,
      reviewedAt: this.now(),
    });
    return { ok: true };
  }
}
