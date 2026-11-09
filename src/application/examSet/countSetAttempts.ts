import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";

/** 每套題被寫過幾次（刪除前的確認用，只給管理員）；沒權限回傳 null。 */
export class CountSetAttempts {
  constructor(private readonly attempts: AttemptRepository) {}

  async execute(input: {
    actor: Account;
    setIds: string[];
  }): Promise<Record<string, number> | null> {
    if (!can(input.actor.roles, "uploadSets")) return null;
    return this.attempts.countBySets(input.setIds);
  }
}
