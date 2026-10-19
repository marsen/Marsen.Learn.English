import type { ExamSet, ExamSetPrivate } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { statusAfter, type TeacherReview } from "@/domain/examSet/review";

/** 記憶體版題組 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryExamSetRepository implements ExamSetRepository {
  private readonly sets = new Map<string, ExamSet>();
  private readonly privates = new Map<string, ExamSetPrivate>();
  private readonly reviews = new Map<string, TeacherReview>();

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

  async findById(setId: string): Promise<ExamSet | null> {
    const s = this.sets.get(setId);
    return s ? structuredClone(s) : null;
  }

  async findPrivate(setId: string): Promise<ExamSetPrivate | null> {
    const p = this.privates.get(setId);
    return p ? structuredClone(p) : null;
  }

  async findReview(setId: string): Promise<TeacherReview | null> {
    const r = this.reviews.get(setId);
    return r ? structuredClone(r) : null;
  }

  async saveReview(review: TeacherReview): Promise<void> {
    const set = this.sets.get(review.setId);
    if (!set) throw new Error(`沒有題組 ${review.setId}`);
    this.reviews.set(review.setId, structuredClone(review));
    set.status = statusAfter(review.decision);
  }

  /** 測試用：取私密部分 */
  privateOf(setId: string): ExamSetPrivate | undefined {
    return this.privates.get(setId);
  }
}
