import { randomUUID } from "node:crypto";
import type { Attempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";

/** 記憶體版作答 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, Attempt>();

  async create(input: {
    setId: string;
    accountId: string | null;
    startedAt: Date;
  }): Promise<Attempt> {
    const a: Attempt = { id: randomUUID(), ...input, answers: null, submittedAt: null };
    this.attempts.set(a.id, a);
    return structuredClone(a);
  }

  async findById(id: string): Promise<Attempt | null> {
    const a = this.attempts.get(id);
    return a ? structuredClone(a) : null;
  }

  async submit(id: string, answers: Record<string, string>, at: Date): Promise<boolean> {
    const a = this.attempts.get(id);
    if (!a || a.submittedAt) return false;
    a.answers = { ...answers };
    a.submittedAt = at;
    return true;
  }
}
