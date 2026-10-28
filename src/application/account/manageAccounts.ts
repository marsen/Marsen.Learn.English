import type { Account } from "@/domain/account/account";
import type { AccountRepository } from "@/domain/account/accountRepository";
import { can } from "@/domain/account/permission";
import { cleanRoles, roleProblems, type RoleProblem } from "@/domain/account/roleRules";
import { isValidEmail, normalizeEmail } from "@/domain/auth/email";

/** 管理帳號失敗的原因（代碼；文字在翻譯檔 errors.manage.*） */
export type ManageError =
  | RoleProblem
  | { code: "notLoggedIn" }
  | { code: "forbidden" }
  | { code: "invalidEmail" }
  | { code: "emailTaken" }
  | { code: "accountNotFound" };

export type ManageResult = { ok: true } | { ok: false; problems: ManageError[] };

const FORBIDDEN: ManageResult = { ok: false, problems: [{ code: "forbidden" }] };

/** 帳號清單（管理權限）。 */
export class ListAccounts {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: { actor: Account }): Promise<Account[] | null> {
    return can(input.actor.roles, "manageRoles") ? this.accounts.list() : null;
  }
}

/** 新增帳號並指定角色（例如先幫老師建好帳號，老師再用 email 登入）。 */
export class AddAccount {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: {
    actor: Account;
    email: string;
    roles: string[];
  }): Promise<ManageResult> {
    if (!can(input.actor.roles, "manageRoles")) return FORBIDDEN;
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) return { ok: false, problems: [{ code: "invalidEmail" }] };
    const problems = roleProblems({
      actorId: input.actor.id,
      targetId: "",
      roles: input.roles,
    });
    if (problems.length > 0) return { ok: false, problems };
    if (await this.accounts.findByEmail(email))
      return { ok: false, problems: [{ code: "emailTaken" }] };
    const account = await this.accounts.create(email);
    await this.accounts.setRoles(account.id, cleanRoles(input.roles));
    return { ok: true };
  }
}

/** 改某個帳號的角色（整個取代）。 */
export class SetAccountRoles {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: {
    actor: Account;
    accountId: string;
    roles: string[];
  }): Promise<ManageResult> {
    if (!can(input.actor.roles, "manageRoles")) return FORBIDDEN;
    const problems = roleProblems({
      actorId: input.actor.id,
      targetId: input.accountId,
      roles: input.roles,
    });
    if (problems.length > 0) return { ok: false, problems };
    if (!(await this.accounts.findById(input.accountId))) {
      return { ok: false, problems: [{ code: "accountNotFound" }] };
    }
    await this.accounts.setRoles(input.accountId, cleanRoles(input.roles));
    return { ok: true };
  }
}
