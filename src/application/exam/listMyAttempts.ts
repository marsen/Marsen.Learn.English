import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AttemptRecord } from "./examResult";

/** 我的考試紀錄：要有「考試紀錄」權限（學生、老師）。只列交過卷的，新的在前。 */
export class ListMyAttempts {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
  ) {}

  async execute(input: { actor: Account }): Promise<AttemptRecord[] | null> {
    if (!can(input.actor.roles, "keepRecords")) return null;
    const [mine, sets] = await Promise.all([
      this.attempts.listSubmittedByAccount(input.actor.id),
      this.sets.list(),
    ]);
    const titles = new Map(sets.map((s) => [s.setId, s.title]));
    return mine.flatMap((a) =>
      a.submittedAt && a.result
        ? [
            {
              attemptId: a.id,
              setId: a.setId,
              title: titles.get(a.setId) ?? a.setId,
              submittedAt: a.submittedAt,
              score: a.result.score,
              total: a.result.total,
            },
          ]
        : [],
    );
  }
}
