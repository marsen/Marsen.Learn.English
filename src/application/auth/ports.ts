/**
 * application 層需要、由 infrastructure 實作的外部能力（port）。
 */

/** 寄信：登入碼，以及給管理員的通知 */
export interface LoginMailer {
  sendLoginCode(to: string, code: string): Promise<void>;
  sendAdminNotice(to: string, subject: string, text: string): Promise<void>;
}

/** 產生隨機識別、6 位數登入碼，以及雜湊 */
export interface SecretTokens {
  generate(): string;
  generateCode(): string;
  hash(token: string): string;
}

export type Clock = () => Date;
