import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSet } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";

/** 後台題組清單：上傳題目或審稿的人才看得到。 */
export class ListExamSets {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(input: { actor: Account }): Promise<ExamSet[] | null> {
    const allowed =
      can(input.actor.roles, "uploadSets") || can(input.actor.roles, "reviewSets");
    return allowed ? this.sets.list() : null;
  }
}
