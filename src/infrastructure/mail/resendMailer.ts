import type { LoginMailer } from "@/application/auth/ports";
import { LOGIN_TOKEN_TTL_MINUTES } from "@/domain/auth/loginToken";

/** 用 Resend API 寄登入碼（不裝 SDK，直接呼叫 HTTP API）。 */
export class ResendMailer implements LoginMailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendLoginCode(to: string, code: string): Promise<void> {
    await this.send(
      to,
      `你的登入碼：${code}`,
      `你的登入碼是：\n\n${code}\n\n回到網站輸入這組數字就能登入（${LOGIN_TOKEN_TTL_MINUTES} 分鐘內有效，只能用一次）。\n如果不是你申請的，忽略這封信即可。`,
    );
  }

  async sendAdminNotice(to: string, subject: string, text: string): Promise<void> {
    await this.send(to, subject, text);
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, text }),
    });
    if (!res.ok)
      throw new Error(`[mail] Resend 寄信失敗：${res.status} ${await res.text()}`);
  }
}
