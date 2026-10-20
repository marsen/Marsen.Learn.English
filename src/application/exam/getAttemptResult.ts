import { can } from "@/domain/account/permission";
import { ownsAttempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { rolesOf, type Actor } from "@/application/shared/actor";
import type { AttemptResultView } from "./examResult";

/**
 * 看批改結果：要有「看批改結果」權限，而且是自己的作答（路人的作答拿得到 id 就能看）。
 * 看不到一律回 null，不透露作答存不存在。
 */
export class GetAttemptResult {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
  ) {}

  async execute(input: {
    actor: Actor;
    attemptId: string;
  }): Promise<AttemptResultView | null> {
    if (!can(rolesOf(input.actor), "viewResult")) return null;
    const attempt = await this.attempts.findById(input.attemptId);
    if (!attempt || !ownsAttempt(attempt, input.actor?.id ?? null)) return null;
    if (!attempt.result || !attempt.submittedAt) return null;
    const set = await this.sets.findById(attempt.setId);
    return {
      attemptId: attempt.id,
      setId: attempt.setId,
      title: set?.title ?? attempt.setId,
      submittedAt: attempt.submittedAt,
      ...attempt.result,
    };
  }
}
