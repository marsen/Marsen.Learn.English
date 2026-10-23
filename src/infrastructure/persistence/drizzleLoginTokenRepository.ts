import { and, count, desc, eq, gt, isNull, lt, max, sql } from "drizzle-orm";
import { MAX_CODE_ATTEMPTS, type LoginToken } from "@/domain/auth/loginToken";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import { createDb, type Db } from "@/infrastructure/db/client";
import { loginTokens } from "@/infrastructure/db/schema";

export class DrizzleLoginTokenRepository implements LoginTokenRepository {
  constructor(private readonly db: Db = createDb()) {}

  async save(token: LoginToken): Promise<void> {
    await this.db.insert(loginTokens).values(token);
  }

  async latestByEmail(email: string): Promise<LoginToken | null> {
    const [row] = await this.db
      .select()
      .from(loginTokens)
      .where(eq(loginTokens.email, email))
      .orderBy(desc(loginTokens.createdAt))
      .limit(1);
    return row ?? null;
  }

  async consume(tokenHash: string, now: Date): Promise<boolean> {
    // 單一 UPDATE … RETURNING：條件與標記同時完成，同一個碼不會被用兩次（規則同 domain 的 isUsable）
    const rows = await this.db
      .update(loginTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(loginTokens.tokenHash, tokenHash),
          isNull(loginTokens.usedAt),
          gt(loginTokens.expiresAt, now),
          lt(loginTokens.failedAttempts, MAX_CODE_ATTEMPTS),
        ),
      )
      .returning({ tokenHash: loginTokens.tokenHash });
    return rows.length > 0;
  }

  async recordFailedAttempt(tokenHash: string): Promise<number> {
    // 在資料庫裡加一，同時輸錯的請求不會互相蓋掉
    const [row] = await this.db
      .update(loginTokens)
      .set({ failedAttempts: sql`${loginTokens.failedAttempts} + 1` })
      .where(eq(loginTokens.tokenHash, tokenHash))
      .returning({ failedAttempts: loginTokens.failedAttempts });
    return row?.failedAttempts ?? 0;
  }

  async countSince(since: Date): Promise<number> {
    return this.countWhere(gt(loginTokens.createdAt, since));
  }

  async countByEmailSince(email: string, since: Date): Promise<number> {
    return this.countWhere(
      and(eq(loginTokens.email, email), gt(loginTokens.createdAt, since)),
    );
  }

  async countByIpSince(ipHash: string, since: Date): Promise<number> {
    return this.countWhere(
      and(eq(loginTokens.ipHash, ipHash), gt(loginTokens.createdAt, since)),
    );
  }

  async latestCreatedAtByEmail(email: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ latest: max(loginTokens.createdAt) })
      .from(loginTokens)
      .where(eq(loginTokens.email, email));
    return row?.latest ?? null;
  }

  private async countWhere(where: ReturnType<typeof and>): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(loginTokens).where(where);
    return row?.n ?? 0;
  }
}
