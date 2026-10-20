import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import { isValidEmail, normalizeEmail } from "@/domain/auth/email";
import { loginTokenExpiry } from "@/domain/auth/loginToken";
import type { Clock, LoginMailer, SecretTokens } from "./ports";
import type { RequestLoginLinkResult } from "./authResult";

/**
 * 申請登入連結（也是註冊）：任何 email 都會收到信。
 * 帳號在點了連結、證明信箱是自己的之後才建立（見 VerifyLoginLink），打錯的 email 不會留下帳號。
 */
export class RequestLoginLink {
  constructor(
    private readonly tokens: LoginTokenRepository,
    private readonly secrets: SecretTokens,
    private readonly mailer: LoginMailer,
    private readonly siteUrl: string,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { email: string }): Promise<RequestLoginLinkResult> {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) return { ok: false, error: "email 格式不對" };

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
