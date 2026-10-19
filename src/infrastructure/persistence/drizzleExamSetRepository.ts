import { desc, eq } from "drizzle-orm";
import type { ExamSet, ExamSetPrivate } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { isAiVerdict } from "@/domain/examSet/bundle";
import { createDb, type Db } from "@/infrastructure/db/client";
import { examSetPrivates, examSets } from "@/infrastructure/db/schema";

type Row = typeof examSets.$inferSelect;

function toDomain(row: Row): ExamSet {
  return {
    ...row,
    aiVerdict: isAiVerdict(row.aiVerdict) ? row.aiVerdict : "needs_human",
    status: "pending_review",
  };
}

export class DrizzleExamSetRepository implements ExamSetRepository {
  constructor(private readonly db: Db = createDb()) {}

  async exists(setId: string): Promise<boolean> {
    const rows = await this.db
      .select({ setId: examSets.setId })
      .from(examSets)
      .where(eq(examSets.setId, setId))
      .limit(1);
    return rows.length > 0;
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
}
