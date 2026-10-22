import type { LoginToken } from "@/domain/auth/loginToken";
import { isUsable } from "@/domain/auth/loginToken";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";

/** 記憶體版登入碼 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryLoginTokenRepository implements LoginTokenRepository {
  private readonly tokens = new Map<string, LoginToken>();

  async save(token: LoginToken): Promise<void> {
    this.tokens.set(token.tokenHash, { ...token });
  }

  async latestByEmail(email: string): Promise<LoginToken | null> {
    const mine = [...this.tokens.values()].filter((t) => t.email === email);
    if (mine.length === 0) return null;
    const latest = mine.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
    return { ...latest };
  }

  async consume(tokenHash: string, now: Date): Promise<boolean> {
    const token = this.tokens.get(tokenHash);
    if (!token || !isUsable(token, now)) return false;
    token.usedAt = now;
    return true;
  }

  async recordFailedAttempt(tokenHash: string): Promise<number> {
    const token = this.tokens.get(tokenHash);
    if (!token) return 0;
    token.failedAttempts += 1;
    return token.failedAttempts;
  }

  async countSince(since: Date): Promise<number> {
    return this.since(since).length;
  }

  async countByEmailSince(email: string, since: Date): Promise<number> {
    return this.since(since).filter((t) => t.email === email).length;
  }

  async countByIpSince(ipHash: string, since: Date): Promise<number> {
    return this.since(since).filter((t) => t.ipHash === ipHash).length;
  }

  async latestCreatedAtByEmail(email: string): Promise<Date | null> {
    const times = [...this.tokens.values()]
      .filter((t) => t.email === email)
      .map((t) => t.createdAt.getTime());
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }

  /** 測試用：看目前存了什麼 */
  all(): LoginToken[] {
    return [...this.tokens.values()].map((t) => ({ ...t }));
  }

  private since(since: Date): LoginToken[] {
    return [...this.tokens.values()].filter(
      (t) => t.createdAt.getTime() > since.getTime(),
    );
  }
}
