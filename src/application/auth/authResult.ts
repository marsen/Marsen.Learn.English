import type { SendBlock } from "@/domain/auth/sendLimits";

/** 登入相關的錯誤（代碼）；畫面再轉成使用者的語言 */
export type LoginError = { code: "invalidEmail" } | { code: "invalidLink" } | SendBlock;

export type RequestLoginLinkResult = { ok: true } | { ok: false; error: LoginError };

export type VerifyLoginLinkResult =
  | { ok: true; accountId: string; isNew: boolean; guestId: string | null }
  | { ok: false; error: LoginError };
