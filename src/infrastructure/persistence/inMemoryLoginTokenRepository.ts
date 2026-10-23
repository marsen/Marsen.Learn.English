import type { LoginToken } from "@/domain/auth/loginToken";
import { isUsable } from "@/domain/auth/loginToken";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";

/** 記憶體版登入碼 repository（只給測試用；網站本身一律用資料庫）。 */
export class InMemoryLoginTokenRepository implements LoginTokenRepository {
  private readonly tokens = new Map<string, LoginToken>();

  async save(token: LoginToken): Promise<void> {
    this.tokens.set(token.tokenHash, { ...token });
  }

  async consume(
    tokenHash: string,
    now: Date,
  ): Promise<{ email: string; guestId: string | null } | null> {
    const token = this.tokens.get(tokenHash);
    if (!token || !isUsable(token, now)) return null;
    token.usedAt = now;
    return { email: token.email, guestId: token.guestId };
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
