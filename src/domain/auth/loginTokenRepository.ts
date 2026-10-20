import type { LoginToken } from "./loginToken";

/** 一次性登入碼儲存的 port。也用來計算寄了幾封登入信。 */
export interface LoginTokenRepository {
  save(token: LoginToken): Promise<void>;
  /**
   * 用掉一個登入碼：可用（isUsable）才標記為已用並回傳 email 與申請時的瀏覽器識別，否則回傳 null。
   * 必須是原子操作，同一個碼不能被用兩次。
   */
  consume(
    tokenHash: string,
    now: Date,
  ): Promise<{ email: string; guestId: string | null } | null>;
  /** since 之後全站寄了幾封 */
  countSince(since: Date): Promise<number>;
  countByEmailSince(email: string, since: Date): Promise<number>;
  countByIpSince(ipHash: string, since: Date): Promise<number>;
  /** 這個 email 最近一次申請的時間；沒申請過回 null */
  latestCreatedAtByEmail(email: string): Promise<Date | null>;
}
