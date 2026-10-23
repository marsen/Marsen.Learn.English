import { and, countDistinct, desc, eq, gte, lt } from "drizzle-orm";
import {
  isExamAccess,
  isExamSetStatus,
  type ExamAccess,
  type ExamSet,
  type ExamSetPrivate,
} from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { isAiVerdict } from "@/domain/examSet/bundle";
import {
  fromLegacyNotes,
  isReviewDecision,
  statusAfter,
  toLegacyNotes,
  type ReviewRecord,
  type TeacherReview,
} from "@/domain/examSet/review";
import { createDb, type Db } from "@/infrastructure/db/client";
import { isUuid } from "./uuid";
import {
  examReviewLog,
  examSetPrivates,
  examSetReviews,
  examSets,
} from "@/infrastructure/db/schema";

type Row = typeof examSets.$inferSelect;

function toDomain(row: Row): ExamSet {
  return {
    ...row,
    aiVerdict: isAiVerdict(row.aiVerdict) ? row.aiVerdict : "needs_human",
    status: isExamSetStatus(row.status) ? row.status : "pending_review",
    access: isExamAccess(row.access) ? row.access : "members",
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
    return {
      setId: row.setId,
      reviewerId: row.reviewerId,
      decision: row.decision,
      comment: row.comment,
      notes: row.notes ?? fromLegacyNotes(row.audioNote, row.questionNotes),
      aiActions: row.aiActions ?? [],
      reviewedAt: row.reviewedAt,
    };
  }

  async saveReview(review: TeacherReview): Promise<void> {
    const { setId, ...fields } = review;
    // 舊欄位過渡期照樣寫，讓還在跑的舊版程式讀得到
    const rest = { ...fields, ...toLegacyNotes(review.notes) };
    const [set] = await this.db
      .select({ title: examSets.title })
      .from(examSets)
      .where(eq(examSets.setId, setId))
      .limit(1);
    if (!set) throw new Error(`沒有題組 ${setId}`);
    await this.db.batch([
      this.db
        .insert(examSetReviews)
        .values({ setId, ...rest })
        .onConflictDoUpdate({ target: examSetReviews.setId, set: rest }),
      this.db.insert(examReviewLog).values({
        setId,
        setTitle: set.title,
        reviewerId: review.reviewerId,
        decision: review.decision,
        reviewedAt: review.reviewedAt,
      }),
      this.db
        .update(examSets)
        .set({ status: statusAfter(review.decision) })
        .where(eq(examSets.setId, setId)),
    ]);
  }

  async setAccess(setId: string, access: ExamAccess): Promise<void> {
    await this.db.update(examSets).set({ access }).where(eq(examSets.setId, setId));
  }

  async countReviewsBy(reviewerId: string, since: Date): Promise<number> {
    if (!isUuid(reviewerId)) return 0;
    const [row] = await this.db
      .select({ n: countDistinct(examReviewLog.setId) })
      .from(examReviewLog)
      .where(
        and(
          eq(examReviewLog.reviewerId, reviewerId),
          gte(examReviewLog.reviewedAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  async listReviewRecords(from: Date, to: Date): Promise<ReviewRecord[]> {
    const rows = await this.db
      .select({
        setId: examReviewLog.setId,
        setTitle: examReviewLog.setTitle,
        reviewerId: examReviewLog.reviewerId,
        decision: examReviewLog.decision,
        reviewedAt: examReviewLog.reviewedAt,
      })
      .from(examReviewLog)
      .where(and(gte(examReviewLog.reviewedAt, from), lt(examReviewLog.reviewedAt, to)))
      .orderBy(desc(examReviewLog.reviewedAt));
    return rows.flatMap(({ decision, ...r }) =>
      isReviewDecision(decision) ? [{ ...r, decision }] : [],
    );
  }

  async delete(setId: string): Promise<void> {
    // exam_set_privates、exam_set_reviews 設了 on delete cascade
    await this.db.delete(examSets).where(eq(examSets.setId, setId));
  }
}
