/**
 * 一次性登入碼。資料庫只存雜湊（tokenHash），原始碼只出現在寄出的連結裡。
 */
export type LoginToken = {
  tokenHash: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/** 登入連結有效時間 */
export const LOGIN_TOKEN_TTL_MINUTES = 15;

export function loginTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + LOGIN_TOKEN_TTL_MINUTES * 60_000);
}

/** 沒用過、也還沒過期，才能拿來登入 */
export function isUsable(token: LoginToken, now: Date): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}
