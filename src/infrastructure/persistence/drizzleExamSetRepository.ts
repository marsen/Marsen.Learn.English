import { desc, eq } from "drizzle-orm";
import {
  isExamSetStatus,
  type ExamSet,
  type ExamSetPrivate,
} from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { isAiVerdict } from "@/domain/examSet/bundle";
import {
  isReviewDecision,
  statusAfter,
  type TeacherReview,
} from "@/domain/examSet/review";
import { createDb, type Db } from "@/infrastructure/db/client";
import { examSetPrivates, examSetReviews, examSets } from "@/infrastructure/db/schema";

type Row = typeof examSets.$inferSelect;

function toDomain(row: Row): ExamSet {
  return {
    ...row,
    aiVerdict: isAiVerdict(row.aiVerdict) ? row.aiVerdict : "needs_human",
    status: isExamSetStatus(row.status) ? row.status : "pending_review",
  };
}

export class DrizzleExamSetRepository implements ExamSetRepository {
  constructor(private readonly db: Db = createDb()) {}

  async exists(setId: string): Promise<boolean> {
    return (await this.findById(setId)) !== null;
  }

  async save(set: ExamSet, secret: ExamSetPrivate): Promise<void> {
    // batch 在 Neon 上是同一個交易：兩張表一起成功或一起失敗
    await this.db.batch([
      this.db.insert(examSets).values(set),
      this.db.insert(examSetPrivates).values(secret),
    ]);
  }

  async list(): Promise<ExamSet[]> {
    const rows = await this.db.select().from(examSets).orderBy(desc(examSets.uploadedAt));
    return rows.map(toDomain);
  }

  async findById(setId: string): Promise<ExamSet | null> {
    const [row] = await this.db
      .select()
      .from(examSets)
      .where(eq(examSets.setId, setId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findPrivate(setId: string): Promise<ExamSetPrivate | null> {
    const [row] = await this.db
      .select()
      .from(examSetPrivates)
      .where(eq(examSetPrivates.setId, setId))
      .limit(1);
    return row ?? null;
  }

  async findReview(setId: string): Promise<TeacherReview | null> {
    const [row] = await this.db
      .select()
      .from(examSetReviews)
      .where(eq(examSetReviews.setId, setId))
      .limit(1);
    if (!row || !isReviewDecision(row.decision)) return null;
    return { ...row, decision: row.decision };
  }

  async saveReview(review: TeacherReview): Promise<void> {
    const { setId, ...rest } = review;
    await this.db.batch([
      this.db
        .insert(examSetReviews)
        .values(review)
        .onConflictDoUpdate({ target: examSetReviews.setId, set: rest }),
      this.db
        .update(examSets)
        .set({ status: statusAfter(review.decision) })
        .where(eq(examSets.setId, setId)),
    ]);
  }
}
