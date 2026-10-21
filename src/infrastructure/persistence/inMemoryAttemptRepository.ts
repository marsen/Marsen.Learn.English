import { randomUUID } from "node:crypto";
import type { Attempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { GradeResult } from "@/domain/exam/grading";

/** 記憶體版作答 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, Attempt>();

  async create(input: {
    setId: string;
    accountId: string | null;
    guestId: string | null;
    startedAt: Date;
  }): Promise<Attempt> {
    const a: Attempt = {
      id: randomUUID(),
      ...input,
      answers: null,
      result: null,
      submittedAt: null,
    };
    this.attempts.set(a.id, a);
    return structuredClone(a);
  }

  async findById(id: string): Promise<Attempt | null> {
    const a = this.attempts.get(id);
    return a ? structuredClone(a) : null;
  }

  async submit(
    id: string,
    answers: Record<string, string>,
    result: GradeResult,
    at: Date,
  ): Promise<boolean> {
    const a = this.attempts.get(id);
    if (!a || a.submittedAt) return false;
    a.answers = { ...answers };
    a.result = structuredClone(result);
    a.submittedAt = at;
    return true;
  }

  async claimGuestAttempts(guestId: string, accountId: string): Promise<string[]> {
    const mine = [...this.attempts.values()]
      .filter((a) => a.accountId === null && a.guestId === guestId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    for (const a of mine) {
      a.accountId = accountId;
      a.guestId = null;
    }
    return mine.map((a) => a.id);
  }

  async listSubmittedByAccount(accountId: string): Promise<Attempt[]> {
    return [...this.attempts.values()]
      .filter((a) => a.accountId === accountId && a.submittedAt !== null)
      .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
      .map((a) => structuredClone(a));
  }

  async countBySet(setId: string): Promise<number> {
    return [...this.attempts.values()].filter((a) => a.setId === setId).length;
  }
}
