import type { AccountRepository } from "@/domain/account/accountRepository";
import { isValidEmail, normalizeEmail } from "@/domain/auth/email";
import {
  isUsable,
  MAX_CODE_ATTEMPTS,
  normalizeLoginCode,
} from "@/domain/auth/loginToken";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import { codeHashOf } from "./loginCode";
import type { Clock, SecretTokens } from "./ports";
import type { VerifyLoginCodeResult } from "./authResult";

/**
 * 用 email＋登入碼完成登入：只認這個 email 最新的一組碼，用過就失效、過期就失效、
 * 錯 MAX_CODE_ATTEMPTS 次就作廢（要重新申請）。
 * 第一次登入的 email 在這裡建立帳號，角色是學生（＝註冊）。
 * 成功回傳帳號 id（由呼叫端建立 session）與申請時的瀏覽器識別（用來認領路人作答）。
 */
export class VerifyLoginCode {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tokens: LoginTokenRepository,
    private readonly secrets: SecretTokens,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { email: string; code: string }): Promise<VerifyLoginCodeResult> {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) return { ok: false, error: { code: "invalidEmail" } };
    const code = normalizeLoginCode(input.code);
    if (!code) return { ok: false, error: { code: "malformedCode" } };

    const now = this.now();
    const token = await this.tokens.latestByEmail(email);
    if (!token || !token.codeHash || !isUsable(token, now))
      return { ok: false, error: { code: "codeExpired" } };

    if (token.codeHash !== codeHashOf(this.secrets, email, code)) {
      const failed = await this.tokens.recordFailedAttempt(token.tokenHash);
      const remaining = MAX_CODE_ATTEMPTS - failed;
      return {
        ok: false,
        error: remaining > 0 ? { code: "wrongCode", remaining } : { code: "codeExpired" },
      };
    }

    if (!(await this.tokens.consume(token.tokenHash, now)))
      return { ok: false, error: { code: "codeExpired" } };
    const { guestId } = token;

    const existing = await this.accounts.findByEmail(email);
    if (existing) return { ok: true, accountId: existing.id, isNew: false, guestId };
    const created = await this.accounts.create(email);
    await this.accounts.addRole(created.id, "student");
    return { ok: true, accountId: created.id, isNew: true, guestId };
  }
}
