import type { AccountRepository } from "@/domain/account/accountRepository";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import { isValidEmail, normalizeEmail } from "@/domain/auth/email";
import { loginTokenExpiry } from "@/domain/auth/loginToken";
import type { Clock, LoginMailer, SecretTokens } from "./ports";
import type { RequestLoginLinkResult } from "./authResult";

/**
 * 申請登入連結。
 * - 目前還沒開放註冊：只有已存在的帳號會收到信（學生註冊排在第 7 步）。
 * - 不管帳號存不存在都回成功，避免被拿來試探哪些 email 有帳號。
 */
export class RequestLoginLink {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tokens: LoginTokenRepository,
    private readonly secrets: SecretTokens,
    private readonly mailer: LoginMailer,
    private readonly siteUrl: string,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { email: string }): Promise<RequestLoginLinkResult> {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) return { ok: false, error: "email 格式不對" };

    const account = await this.accounts.findByEmail(email);
    if (!account) return { ok: true };

    const token = this.secrets.generate();
    await this.tokens.save({
      tokenHash: this.secrets.hash(token),
      email,
      expiresAt: loginTokenExpiry(this.now()),
      usedAt: null,
    });

    const link = new URL("/auth/verify", this.siteUrl);
    link.searchParams.set("token", token);
    await this.mailer.sendLoginLink(email, link.toString());
    return { ok: true };
  }
}
