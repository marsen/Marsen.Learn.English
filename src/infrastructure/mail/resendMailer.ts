import type { LoginMailer } from "@/application/auth/ports";
import { loginCodeMail } from "./loginCodeMail";

/** 用 Resend API 寄信（不裝 SDK，直接呼叫 HTTP API）。登入信內容見 loginCodeMail。 */
export class ResendMailer implements LoginMailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendLoginCode(to: string, code: string): Promise<void> {
    const { subject, text, html } = loginCodeMail(code);
    await this.send(to, subject, text, html);
  }

  async sendAdminNotice(to: string, subject: string, text: string): Promise<void> {
    await this.send(to, subject, text);
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, text, html }),
    });
    if (!res.ok)
      throw new Error(`[mail] Resend 寄信失敗：${res.status} ${await res.text()}`);
  }
}
