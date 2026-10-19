import type { LoginMailer } from "@/application/auth/ports";

/**
 * 開發用寄信：不真的寄出，只記下最後一封，讓登入頁直接顯示連結。
 * 只會在非正式環境、而且沒設定 RESEND_API_KEY 時使用（見 di/authContainer）。
 */
export class DevMailer implements LoginMailer {
  private readonly lastLinks = new Map<string, string>();

  async sendLoginLink(to: string, link: string): Promise<void> {
    this.lastLinks.set(to, link);
    console.info(`[dev-mail] 登入連結 → ${to}: ${link}`);
  }

  lastLinkFor(email: string): string | null {
    return this.lastLinks.get(email) ?? null;
  }
}
