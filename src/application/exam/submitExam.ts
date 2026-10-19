import { normalizeAnswers, ownsAttempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import { blanksOf } from "@/domain/exam/paper";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { Actor } from "@/application/shared/actor";
import type { SubmitExamResult } from "./examResult";

/**
 * 交卷：存下答案（只收這張考卷的題號）。一次作答只能交一次。
 * 批改是第 5 步。
 */
export class SubmitExam {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: {
    actor: Actor;
    attemptId: string;
    answers: Record<string, unknown>;
  }): Promise<SubmitExamResult> {
    const attempt = await this.attempts.findById(input.attemptId);
    if (!attempt || !ownsAttempt(attempt, input.actor?.id ?? null)) {
      return { ok: false, reason: "not_found" };
    }
    if (attempt.submittedAt) return { ok: false, reason: "already_submitted" };

    const set = await this.sets.findById(attempt.setId);
    if (!set) return { ok: false, reason: "not_found" };

    const answers = normalizeAnswers(input.answers, blanksOf(set.paper));
    const saved = await this.attempts.submit(attempt.id, answers, this.now());
    return saved ? { ok: true } : { ok: false, reason: "already_submitted" };
  }
}
