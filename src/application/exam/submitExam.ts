import { normalizeAnswers, ownsAttempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import { grade } from "@/domain/exam/grading";
import { blanksOf } from "@/domain/exam/paper";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { Actor } from "@/application/shared/actor";
import { parseAnswerKey } from "@/application/examSet/answerKey";
import type { SubmitExamResult } from "./examResult";

/**
 * 交卷：存下答案（只收這張考卷的題號）並在伺服器端批改。一次作答只能交一次。
 * 標準答案只在伺服器上用，不會送到考生的瀏覽器。
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

    const [set, secret] = await Promise.all([
      this.sets.findById(attempt.setId),
      this.sets.findPrivate(attempt.setId),
    ]);
    if (!set || !secret) return { ok: false, reason: "not_found" };
    const key = parseAnswerKey(secret.answers);
    if (!key.ok)
      throw new Error(`題組 ${set.setId} 的答案卡無法批改：${key.problems.join("；")}`);

    const answers = normalizeAnswers(input.answers, blanksOf(set.paper));
    const saved = await this.attempts.submit(
      attempt.id,
      answers,
      grade(key.entries, answers),
      this.now(),
    );
    return saved
      ? { ok: true, attemptId: attempt.id }
      : { ok: false, reason: "already_submitted" };
  }
}
