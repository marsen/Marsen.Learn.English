import type { SendBlock } from "@/domain/auth/sendLimits";

/** 登入相關的錯誤（代碼）；畫面再轉成使用者的語言 */
export type LoginError =
  | { code: "invalidEmail" }
  /** 登入碼格式不對（不是 6 位數字） */
  | { code: "malformedCode" }
  /** 登入碼不對，還可以再試 remaining 次 */
  | { code: "wrongCode"; remaining: number }
  /** 沒有可用的登入碼（過期、用過、錯太多次，或根本沒申請） */
  | { code: "codeExpired" }
  | SendBlock;

export type RequestLoginCodeResult = { ok: true } | { ok: false; error: LoginError };

export type VerifyLoginCodeResult =
  | { ok: true; accountId: string; isNew: boolean; guestId: string | null }
  | { ok: false; error: LoginError };
