import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { AiVerdict } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { countAiFindings } from "@/application/examSet/reviewView";

export type PendingSetView = {
  setId: string;
  title: string;
  aiVerdict: AiVerdict;
  /** AI 提出的疑點數 */
  findingCount: number;
  uploadedAt: Date;
};

export type TeacherDashboardView = {
  /** 還沒有任何老師審過的題組，最舊的在前面 */
  pending: PendingSetView[];
  /** 這位老師這個月（台灣時間）審了幾套 */
  reviewedThisMonth: number;
};

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 台灣時間這個月 1 號 00:00（台灣沒有日光節約） */
export function startOfMonthInTaipei(now: Date): Date {
  const t = new Date(now.getTime() + TAIPEI_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - TAIPEI_OFFSET_MS);
}

/** 老師的總覽：有審稿權限才看得到。 */
export class GetTeacherDashboard {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(input: {
    actor: Account;
    now: Date;
  }): Promise<TeacherDashboardView | null> {
    if (!can(input.actor.roles, "reviewSets")) return null;

    const waiting = (await this.sets.list())
      .filter((s) => s.status === "pending_review")
      .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());

    const pending = await Promise.all(
      waiting.map(async (s) => {
        const secret = await this.sets.findPrivate(s.setId);
        return {
          setId: s.setId,
          title: s.title,
          aiVerdict: s.aiVerdict,
          findingCount: secret ? countAiFindings(secret.provenance) : 0,
          uploadedAt: s.uploadedAt,
        };
      }),
    );

    const reviewedThisMonth = await this.sets.countReviewsBy(
      input.actor.id,
      startOfMonthInTaipei(input.now),
    );
    return { pending, reviewedThisMonth };
  }
}
