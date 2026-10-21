import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import { discardProblem } from "@/domain/examSet/discard";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { AudioStorage } from "./ports";

export type DeleteExamSetResult = { ok: true } | { ok: false; problem: string };

/** 刪掉審不過的題組（管理員）：連同音檔一起刪。 */
export class DeleteExamSet {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
    private readonly storage: AudioStorage,
  ) {}

  async execute(input: { actor: Account; setId: string }): Promise<DeleteExamSetResult> {
    if (!can(input.actor.roles, "uploadSets")) {
      return { ok: false, problem: "你的帳號沒有刪除題組的權限" };
    }
    const set = await this.sets.findById(input.setId);
    if (!set) return { ok: false, problem: "找不到這套題組" };

    const problem = discardProblem(set, await this.attempts.countBySet(set.setId));
    if (problem) return { ok: false, problem };

    await this.sets.delete(set.setId);
    await this.storage.delete(set.audioKey);
    return { ok: true };
  }
}
