import type { ExamAccess, ExamSet, ExamSetPrivate } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import {
  statusAfter,
  type ReviewRecord,
  type TeacherReview,
} from "@/domain/examSet/review";

/** 記憶體版題組 repository（只給測試用；網站本身一律用資料庫）。 */
export class InMemoryExamSetRepository implements ExamSetRepository {
  private readonly sets = new Map<string, ExamSet>();
  private readonly privates = new Map<string, ExamSetPrivate>();
  private readonly reviews = new Map<string, TeacherReview>();
  private readonly records: ReviewRecord[] = [];

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
    this.records.push({
      setId: review.setId,
      setTitle: set.title,
      reviewerId: review.reviewerId,
      decision: review.decision,
      reviewedAt: review.reviewedAt,
    });
    set.status = statusAfter(review.decision);
  }

  async setAccess(setId: string, access: ExamAccess): Promise<void> {
    const set = this.sets.get(setId);
    if (set) set.access = access;
  }

  /** 測試用：取私密部分 */
  privateOf(setId: string): ExamSetPrivate | undefined {
    return this.privates.get(setId);
  }

  async countReviewsBy(reviewerId: string, since: Date): Promise<number> {
    const setIds = this.records
      .filter((r) => r.reviewerId === reviewerId && r.reviewedAt >= since)
      .map((r) => r.setId);
    return new Set(setIds).size;
  }

  async listReviewRecords(from: Date, to: Date): Promise<ReviewRecord[]> {
    // 先反過來：同一毫秒的紀錄也是後記的在前
    return [...this.records]
      .reverse()
      .filter((r) => r.reviewedAt >= from && r.reviewedAt < to)
      .sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime())
      .map((r) => structuredClone(r));
  }

  async delete(setId: string): Promise<void> {
    this.sets.delete(setId);
    this.privates.delete(setId);
    this.reviews.delete(setId);
  }
}
