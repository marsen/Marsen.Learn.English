import type { AccountRepository } from "@/domain/account/accountRepository";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import type { Clock, SecretTokens } from "./ports";
import type { VerifyLoginLinkResult } from "./authResult";

const INVALID = "登入連結無效或已過期，請重新申請";

/**
 * 用登入連結裡的碼完成登入：碼只能用一次、過期就失效。
 * 第一次登入的 email 在這裡建立帳號，角色是學生（＝註冊）。
 * 成功回傳帳號 id（由呼叫端建立 session）與申請連結的瀏覽器識別（用來認領路人作答）。
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

    const used = await this.tokens.consume(this.secrets.hash(token), this.now());
    if (!used) return { ok: false, error: INVALID };
    const { email, guestId } = used;

    const existing = await this.accounts.findByEmail(email);
    if (existing) return { ok: true, accountId: existing.id, isNew: false, guestId };
    const created = await this.accounts.create(email);
    await this.accounts.addRole(created.id, "student");
    return { ok: true, accountId: created.id, isNew: true, guestId };
  }
}
