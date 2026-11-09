import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AudioStorage } from "./ports";

export type DeleteExamSetsResult =
  { ok: true; deleted: number } | { ok: false; problem: string };

/**
 * 刪掉題組（管理員）：任何狀態、有沒有人寫過都能刪，連同音檔一起刪。
 * 作答紀錄保留（分數、每題對錯存在作答裡，不靠題組）；審稿紀錄也保留。
 * 不存在的 setId 略過。
 */
export class DeleteExamSets {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly storage: AudioStorage,
  ) {}

  async execute(input: {
    actor: Account;
    setIds: string[];
  }): Promise<DeleteExamSetsResult> {
    if (!can(input.actor.roles, "uploadSets")) {
      return { ok: false, problem: "你的帳號沒有刪除題組的權限" };
    }
    let deleted = 0;
    for (const setId of new Set(input.setIds)) {
      const set = await this.sets.findById(setId);
      if (!set) continue;
      await this.sets.delete(setId);
      await this.storage.delete(set.audioKey);
      deleted++;
    }
    return { ok: true, deleted };
  }
}
