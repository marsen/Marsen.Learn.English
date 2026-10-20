/**
 * application 層需要、由 infrastructure 實作的外部能力（port）。
 */

/** 寄信：登入信，以及給管理員的通知 */
export interface LoginMailer {
  sendLoginLink(to: string, link: string): Promise<void>;
  sendAdminNotice(to: string, subject: string, text: string): Promise<void>;
}

/** 產生一次性登入碼與它的雜湊 */
export interface SecretTokens {
  generate(): string;
  hash(token: string): string;
}

export type Clock = () => Date;
