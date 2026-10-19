import type { ExamSet, ExamSetPrivate } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";

/** 記憶體版題組 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryExamSetRepository implements ExamSetRepository {
  private readonly sets = new Map<string, ExamSet>();
  private readonly privates = new Map<string, ExamSetPrivate>();

  async exists(setId: string): Promise<boolean> {
    return this.sets.has(setId);
  }

  async save(set: ExamSet, secret: ExamSetPrivate): Promise<void> {
    this.sets.set(set.setId, structuredClone(set));
    this.privates.set(secret.setId, structuredClone(secret));
  }

  async list(): Promise<ExamSet[]> {
    return [...this.sets.values()]
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map((s) => structuredClone(s));
  }

  /** 測試用：取私密部分 */
  privateOf(setId: string): ExamSetPrivate | undefined {
    return this.privates.get(setId);
  }
}
