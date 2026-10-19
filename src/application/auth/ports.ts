/**
 * application 層需要、由 infrastructure 實作的外部能力（port）。
 */

/** 寄登入信 */
export interface LoginMailer {
  sendLoginLink(to: string, link: string): Promise<void>;
}

/** 產生一次性登入碼與它的雜湊 */
export interface SecretTokens {
  generate(): string;
  hash(token: string): string;
}

export type Clock = () => Date;
