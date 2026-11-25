import type { RequestLoginCodeResult } from "@/application/auth/authResult";
import type { LoginFormState } from "@/presentation/components/formStates";

type Input = {
  prev: LoginFormState;
  email: string;
  result: RequestLoginCodeResult;
  /** 開發模式（沒有寄信服務）剛發出的登入碼；正式環境一律 null */
  devCode: string | null;
  now: number;
};

/**
 * 申請登入碼之後的表單狀態。
 * - 成功：進入輸入登入碼的步驟
 * - 失敗：留在原本的步驟（重寄失敗時上一組碼可能還能用）
 * - 開發模式被「60 秒內不能重寄」擋下：上一組碼還能用，帶著它進入輸入登入碼的步驟
 *   （例如重新整理頁面後又按了一次寄送）
 */
export function loginRequestState({
  prev,
  email,
  result,
  devCode,
  now,
}: Input): LoginFormState {
  if (result.ok) return { sentTo: email, sentAt: now, devCode: devCode ?? undefined };
  if (result.error.code === "cooldown" && devCode) {
    return {
      error: result.error,
      sentTo: email,
      sentAt: prev.sentTo === email ? prev.sentAt : now,
      devCode,
    };
  }
  return { error: result.error, email, sentTo: prev.sentTo, sentAt: prev.sentAt };
}
