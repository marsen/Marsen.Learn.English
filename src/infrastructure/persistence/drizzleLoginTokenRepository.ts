import { and, eq, gt, isNull } from "drizzle-orm";
import type { LoginToken } from "@/domain/auth/loginToken";
import type { LoginTokenRepository } from "@/domain/auth/loginTokenRepository";
import { createDb, type Db } from "@/infrastructure/db/client";
import { loginTokens } from "@/infrastructure/db/schema";

export class DrizzleLoginTokenRepository implements LoginTokenRepository {
  constructor(private readonly db: Db = createDb()) {}

  async save(token: LoginToken): Promise<void> {
    await this.db.insert(loginTokens).values(token);
  }

  async consume(tokenHash: string, now: Date): Promise<string | null> {
    // 單一 UPDATE … RETURNING：條件與標記同時完成，同一個碼不會被用兩次（規則同 domain 的 isUsable）
    const [row] = await this.db
      .update(loginTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(loginTokens.tokenHash, tokenHash),
          isNull(loginTokens.usedAt),
          gt(loginTokens.expiresAt, now),
        ),
      )
      .returning({ email: loginTokens.email });
    return row?.email ?? null;
  }
}
