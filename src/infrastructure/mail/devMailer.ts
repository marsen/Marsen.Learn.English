import type { LoginMailer } from "@/application/auth/ports";

/**
 * 開發用寄信：不真的寄出，只記下最後一組登入碼，讓登入頁直接顯示。
 * 只會在非正式環境、而且沒設定 RESEND_API_KEY 時使用（見 di/authContainer）。
 */
export class DevMailer implements LoginMailer {
  private readonly lastCodes = new Map<string, string>();

  async sendLoginCode(to: string, code: string): Promise<void> {
    this.lastCodes.set(to, code);
    console.info(`[dev-mail] 登入碼 → ${to}: ${code}`);
  }

  /** 給管理員的通知（開發時只記下來、印出來） */
  readonly notices: { to: string; subject: string; text: string }[] = [];

  async sendAdminNotice(to: string, subject: string, text: string): Promise<void> {
    this.notices.push({ to, subject, text });
    console.info(`[dev-mail] 管理員通知 → ${to}: ${subject}`);
  }

  lastCodeFor(email: string): string | null {
    return this.lastCodes.get(email) ?? null;
  }
}
