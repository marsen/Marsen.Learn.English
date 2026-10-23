import type { AccountRepository } from "@/domain/account/accountRepository";
import { can } from "@/domain/account/permission";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import { isValidEmail, normalizeEmail } from "@/domain/auth/email";
import { loginTokenExpiry } from "@/domain/auth/loginToken";
import {
  alertThresholdReached,
  sendBlockReason,
  DAY_MS,
  HOUR_MS,
  PROVIDER_DAILY_LIMIT,
} from "@/domain/auth/sendLimits";
import type { Clock, LoginMailer, SecretTokens } from "./ports";
import type { RequestLoginLinkResult } from "./authResult";

/**
 * 申請登入連結（也是註冊）：任何 email 都會收到信。
 * 帳號在點了連結、證明信箱是自己的之後才建立（見 VerifyLoginLink），打錯的 email 不會留下帳號。
 * 寄信有次數限制（見 domain/auth/sendLimits），寄到 50、80 封時通知管理員。
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

  async execute(input: {
    email: string;
    /** 申請的瀏覽器（路人識別）；在別的裝置點連結時，靠它把路人作答移過去 */
    guestId?: string | null;
    /** 申請者 IP 的雜湊 */
    ipHash?: string | null;
  }): Promise<RequestLoginLinkResult> {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) return { ok: false, error: { code: "invalidEmail" } };

    const now = this.now();
    const hourAgo = new Date(now.getTime() - HOUR_MS);
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const ipHash = input.ipHash ?? null;
    const [lastSentToEmail, emailSentLastHour, ipSentLastHour, sentLastDay, account] =
      await Promise.all([
        this.tokens.latestCreatedAtByEmail(email),
        this.tokens.countByEmailSince(email, hourAgo),
        ipHash ? this.tokens.countByIpSince(ipHash, hourAgo) : Promise.resolve(null),
        this.tokens.countSince(dayAgo),
        this.accounts.findByEmail(email),
      ]);
    const blocked = sendBlockReason({
      now,
      lastSentToEmail,
      emailSentLastHour,
      ipSentLastHour,
      sentLastDay,
      hasAccount: account !== null,
    });
    if (blocked) return { ok: false, error: blocked };

    const token = this.secrets.generate();
    await this.tokens.save({
      tokenHash: this.secrets.hash(token),
      email,
      expiresAt: loginTokenExpiry(now),
      usedAt: null,
      createdAt: now,
      guestId: input.guestId ?? null,
      ipHash,
    });

    const link = new URL("/auth/verify", this.siteUrl);
    link.searchParams.set("token", token);
    await this.mailer.sendLoginLink(email, link.toString());

    const reached = alertThresholdReached(sentLastDay + 1);
    if (reached !== null) await this.notifyAdmins(reached);
    return { ok: true };
  }

  private async notifyAdmins(count: number): Promise<void> {
    const admins = (await this.accounts.list()).filter((a) =>
      can(a.roles, "manageRoles"),
    );
    const subject = `登入信今天已寄 ${count} 封`;
    const text = [
      `最近 24 小時已經寄出 ${count} 封登入／註冊信。`,
      `Resend 免費版每天上限 ${PROVIDER_DAILY_LIMIT} 封；到 95 封時網站會暫停新註冊（已有帳號的人仍可登入）。`,
      "如果這是正常的註冊量，可以考慮升級寄信方案或加上 Google 登入；如果不正常，可能有人在灌信。",
    ].join("\n");
    await Promise.all(
      admins.map((a) => this.mailer.sendAdminNotice(a.email, subject, text)),
    );
  }
}
