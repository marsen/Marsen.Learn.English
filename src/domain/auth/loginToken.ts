/**
 * 一次性登入碼（寄到信箱的 6 位數字）。
 * - tokenHash：這一筆的識別（隨機值；舊版登入連結的資料是連結 token 的雜湊）
 * - codeHash：email＋登入碼的雜湊；資料庫不存原始登入碼
 * - 輸入錯 MAX_CODE_ATTEMPTS 次，這組碼就作廢
 */
export type LoginToken = {
  tokenHash: string;
  /** 舊版登入連結留下的資料沒有登入碼，為 null */
  codeHash: string | null;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  /** 輸入錯誤的次數 */
  failedAttempts: number;
  /** 申請登入碼的瀏覽器（路人識別的雜湊）；登入後把路人作答移到帳號名下 */
  guestId: string | null;
  /** 申請者的 IP 雜湊（不存原 IP），用來限制同一個 IP 的寄送次數 */
  ipHash: string | null;
};

/** 登入碼有效時間 */
export const LOGIN_TOKEN_TTL_MINUTES = 15;

/** 登入碼長度（數字） */
export const LOGIN_CODE_LENGTH = 6;

/** 輸入錯幾次就作廢 */
export const MAX_CODE_ATTEMPTS = 3;

export function loginTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + LOGIN_TOKEN_TTL_MINUTES * 60_000);
}

/** 沒用過、沒過期、也還沒錯太多次，才能拿來登入 */
export function isUsable(
  token: Pick<LoginToken, "usedAt" | "expiresAt"> &
    Partial<Pick<LoginToken, "failedAttempts">>,
  now: Date,
): boolean {
  return (
    token.usedAt === null &&
    token.expiresAt.getTime() > now.getTime() &&
    (token.failedAttempts ?? 0) < MAX_CODE_ATTEMPTS
  );
}

/** 使用者輸入的登入碼：去掉空白，必須剛好是 6 位數字 */
export function normalizeLoginCode(raw: string): string | null {
  const code = raw.replace(/\s/g, "");
  return new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`).test(code) ? code : null;
}
