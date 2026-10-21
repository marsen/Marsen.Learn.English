import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Attempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { GradeResult } from "@/domain/exam/grading";
import { createDb, type Db } from "@/infrastructure/db/client";
import { examAttempts } from "@/infrastructure/db/schema";
import { isUuid } from "./uuid";

type Row = typeof examAttempts.$inferSelect;

function toDomain(row: Row): Attempt {
  const { score, total, results, ...rest } = row;
  return {
    ...rest,
    result:
      score !== null && total !== null && results !== null
        ? { score, total, results }
        : null,
  };
}

export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private readonly db: Db = createDb()) {}

  async create(input: {
    setId: string;
    accountId: string | null;
    guestId: string | null;
    startedAt: Date;
  }): Promise<Attempt> {
    const [row] = await this.db.insert(examAttempts).values(input).returning();
    return toDomain(row);
  }

  async findById(id: string): Promise<Attempt | null> {
    if (!isUuid(id)) return null;
    const [row] = await this.db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async submit(
    id: string,
    answers: Record<string, string>,
    result: GradeResult,
    at: Date,
  ): Promise<boolean> {
    // 只更新還沒交卷的那一筆：同時送兩次，只有一次會成功
    const rows = await this.db
      .update(examAttempts)
      .set({
        answers,
        score: result.score,
        total: result.total,
        results: result.results,
        submittedAt: at,
      })
      .where(and(eq(examAttempts.id, id), isNull(examAttempts.submittedAt)))
      .returning({ id: examAttempts.id });
    return rows.length > 0;
  }

  async claimGuestAttempts(guestId: string, accountId: string): Promise<string[]> {
    const rows = await this.db
      .update(examAttempts)
      .set({ accountId, guestId: null })
      .where(and(eq(examAttempts.guestId, guestId), isNull(examAttempts.accountId)))
      .returning({ id: examAttempts.id, startedAt: examAttempts.startedAt });
    return rows
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map((r) => r.id);
  }

  async listSubmittedByAccount(accountId: string): Promise<Attempt[]> {
    const rows = await this.db
      .select()
      .from(examAttempts)
      .where(
        and(eq(examAttempts.accountId, accountId), isNotNull(examAttempts.submittedAt)),
      )
      .orderBy(desc(examAttempts.submittedAt));
    return rows.map(toDomain);
  }
}
