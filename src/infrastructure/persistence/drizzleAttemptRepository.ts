import { and, eq, isNull } from "drizzle-orm";
import type { Attempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import { createDb, type Db } from "@/infrastructure/db/client";
import { examAttempts } from "@/infrastructure/db/schema";

export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private readonly db: Db = createDb()) {}

  async create(input: {
    setId: string;
    accountId: string | null;
    startedAt: Date;
  }): Promise<Attempt> {
    const [row] = await this.db.insert(examAttempts).values(input).returning();
    return row;
  }

  async findById(id: string): Promise<Attempt | null> {
    const [row] = await this.db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.id, id))
      .limit(1);
    return row ?? null;
  }

  async submit(id: string, answers: Record<string, string>, at: Date): Promise<boolean> {
    // 只更新還沒交卷的那一筆：同時送兩次，只有一次會成功
    const rows = await this.db
      .update(examAttempts)
      .set({ answers, submittedAt: at })
      .where(and(eq(examAttempts.id, id), isNull(examAttempts.submittedAt)))
      .returning({ id: examAttempts.id });
    return rows.length > 0;
  }
}
