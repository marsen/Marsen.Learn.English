import type { LoginToken } from "./loginToken";

/** 一次性登入碼儲存的 port。 */
export interface LoginTokenRepository {
  save(token: LoginToken): Promise<void>;
  /**
   * 用掉一個登入碼：可用（isUsable）才標記為已用並回傳 email，否則回傳 null。
   * 必須是原子操作，同一個碼不能被用兩次。
   */
  consume(tokenHash: string, now: Date): Promise<string | null>;
}
