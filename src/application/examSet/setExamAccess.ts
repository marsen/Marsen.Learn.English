import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import { isExamAccess } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";

export type SetExamAccessResult = { ok: true } | { ok: false; problem: string };

/** 管理員設定考卷開放對象（公開／會員）。只有合格的考卷才會真的被考到，但任何狀態都可以先設。 */
export class SetExamAccess {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(input: {
    actor: Account;
    setId: string;
    access: unknown;
  }): Promise<SetExamAccessResult> {
    if (!can(input.actor.roles, "setExamAccess")) {
      return { ok: false, problem: "你的帳號沒有設定考卷開放對象的權限" };
    }
    if (!isExamAccess(input.access))
      return { ok: false, problem: "開放對象只能是公開或會員" };
    if (!(await this.sets.exists(input.setId)))
      return { ok: false, problem: "找不到這套題" };
    await this.sets.setAccess(input.setId, input.access);
    return { ok: true };
  }
}
