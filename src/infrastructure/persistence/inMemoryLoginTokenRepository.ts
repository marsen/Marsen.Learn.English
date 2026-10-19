import type { LoginToken } from "@/domain/auth/loginToken";
import { isUsable } from "@/domain/auth/loginToken";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";

/** 記憶體版登入碼 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryLoginTokenRepository implements LoginTokenRepository {
  private readonly tokens = new Map<string, LoginToken>();

  async save(token: LoginToken): Promise<void> {
    this.tokens.set(token.tokenHash, { ...token });
  }

  async consume(tokenHash: string, now: Date): Promise<string | null> {
    const token = this.tokens.get(tokenHash);
    if (!token || !isUsable(token, now)) return null;
    token.usedAt = now;
    return token.email;
  }

  /** 測試用：看目前存了什麼 */
  all(): LoginToken[] {
    return [...this.tokens.values()].map((t) => ({ ...t }));
  }
}
