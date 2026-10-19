import type { AccountRepository } from "@/domain/account/accountRepository";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import type { Clock, SecretTokens } from "./ports";
import type { VerifyLoginLinkResult } from "./authResult";

const INVALID = "登入連結無效或已過期，請重新申請";

/**
 * 用登入連結裡的碼完成登入：碼只能用一次、過期就失效。
 * 成功回傳帳號 id，由呼叫端建立 session。
 */
export class VerifyLoginLink {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tokens: LoginTokenRepository,
    private readonly secrets: SecretTokens,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { token: string }): Promise<VerifyLoginLinkResult> {
    const token = input.token.trim();
    if (!token) return { ok: false, error: INVALID };

    const email = await this.tokens.consume(this.secrets.hash(token), this.now());
    if (!email) return { ok: false, error: INVALID };

    const account = await this.accounts.findByEmail(email);
    if (!account) return { ok: false, error: INVALID };
    return { ok: true, accountId: account.id };
  }
}
