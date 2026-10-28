import { and, countDistinct, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import {
  isExamAccess,
  isExamSetStatus,
  type ExamAccess,
  type ExamSet,
  type ExamSetPrivate,
} from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { ExamSetFilter, ExamSetSummary } from "@/domain/examSet/examSetFilter";
import { isAiVerdict } from "@/domain/examSet/bundle";
import {
  isReviewDecision,
  statusAfter,
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
type Codes = Pick<Row, "aiVerdict" | "status" | "access">;

/** 資料庫裡的代碼字串 → domain 型別；不認得的值給保守的預設 */
function withCodes<T extends Codes>(row: T) {
  return {
    ...row,
    aiVerdict: isAiVerdict(row.aiVerdict) ? row.aiVerdict : ("needs_human" as const),
    status: isExamSetStatus(row.status) ? row.status : ("pending_review" as const),
    access: isExamAccess(row.access) ? row.access : ("members" as const),
  };
}

function toDomain(row: Row): ExamSet {
  return withCodes(row);
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

  async listSummaries(filter: ExamSetFilter): Promise<ExamSetSummary[]> {
    const where: SQL[] = [];
    if (filter.status) where.push(eq(examSets.status, filter.status));
    if (filter.aiVerdict) where.push(eq(examSets.aiVerdict, filter.aiVerdict));
    if (filter.access) where.push(eq(examSets.access, filter.access));
    if (filter.keyword) {
      // LIKE 的萬用字元當一般字元比對
      const k = `%${filter.keyword.replace(/[\\%_]/g, "\\$&")}%`;
      const match = or(
        ilike(examSets.setId, k),
        ilike(examSets.title, k),
        ilike(examSets.topic, k),
      );
      if (match) where.push(match);
    }
    // 只選清單欄位，不撈題目卷、時間軸
    const rows = await this.db
      .select({
        setId: examSets.setId,
        title: examSets.title,
        topic: examSets.topic,
        questionCount: examSets.questionCount,
        aiVerdict: examSets.aiVerdict,
        status: examSets.status,
        access: examSets.access,
        uploadedAt: examSets.uploadedAt,
      })
      .from(examSets)
      .where(and(...where))
      .orderBy(desc(examSets.uploadedAt));
    return rows.map(withCodes);
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
      // 舊審稿的錄音建議、每題建議已由 migration 0012 搬進 notes
      notes: row.notes ?? [],
      aiActions: row.aiActions ?? [],
      verdicts: row.verdicts ?? [],
      reviewedAt: row.reviewedAt,
    };
  }

  async saveReview(review: TeacherReview): Promise<void> {
    const { setId, ...rest } = review;
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
