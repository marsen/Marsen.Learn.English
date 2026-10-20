import type { LoginMailer } from "@/application/auth/ports";

/** 用 Resend API 寄登入信（不裝 SDK，直接呼叫 HTTP API）。 */
export class ResendMailer implements LoginMailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendLoginLink(to: string, link: string): Promise<void> {
    await this.send(
      to,
      "你的登入連結",
      `點下面的連結登入（15 分鐘內有效，只能用一次）：\n\n${link}\n\n如果不是你申請的，忽略這封信即可。`,
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
