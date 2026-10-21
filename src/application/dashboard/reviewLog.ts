import type { Account } from "@/domain/account/account";
import type { AccountRepository } from "@/domain/account/accountRepository";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { ReviewDecision } from "@/domain/examSet/review";
import { monthOf, monthRange, shiftMonth } from "@/application/shared/taipeiMonth";

export type TeacherTally = {
  reviewerId: string;
  email: string | null;
  /** 這個月審了幾套（同一套審好幾次只算一套） */
  sets: number;
  /** 依每套最後一次的判定 */
  approved: number;
  rejected: number;
};

export type ReviewLogEntry = {
  reviewedAt: Date;
  email: string | null;
  setId: string;
  setTitle: string;
  decision: ReviewDecision;
};

export type ReviewLogView = {
  month: string;
  prevMonth: string;
  /** 已經是這個月就沒有下個月 */
  nextMonth: string | null;
  teachers: TeacherTally[];
  /** 每一筆審稿，新的在前 */
  entries: ReviewLogEntry[];
};

/** 審稿紀錄（管理員）：每位老師某個月審了幾套，算老師費用用。 */
export class GetReviewLog {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(input: {
    actor: Account;
    month?: string;
    now: Date;
  }): Promise<ReviewLogView | null> {
    if (!can(input.actor.roles, "viewReviewLog")) return null;

    const thisMonth = monthOf(input.now);
    const wanted = input.month && monthRange(input.month) ? input.month : thisMonth;
    const month = wanted > thisMonth ? thisMonth : wanted;
    const range = monthRange(month)!;
    const records = await this.sets.listReviewRecords(range.from, range.to);

    const emails = new Map<string, string | null>();
    for (const id of new Set(records.map((r) => r.reviewerId)))
      emails.set(id, (await this.accounts.findById(id))?.email ?? null);

    // records 新的在前：每位老師每套題第一次看到的就是最後的判定
    const latest = new Map<string, Map<string, ReviewDecision>>();
    for (const r of records) {
      const bySet = latest.get(r.reviewerId) ?? new Map<string, ReviewDecision>();
      if (!bySet.has(r.setId)) bySet.set(r.setId, r.decision);
      latest.set(r.reviewerId, bySet);
    }
    const teachers = [...latest.entries()]
      .map(([reviewerId, bySet]) => {
        const decisions = [...bySet.values()];
        return {
          reviewerId,
          email: emails.get(reviewerId) ?? null,
          sets: bySet.size,
          approved: decisions.filter((d) => d === "approved").length,
          rejected: decisions.filter((d) => d === "rejected").length,
        };
      })
      .sort((a, b) => b.sets - a.sets || (a.email ?? "").localeCompare(b.email ?? ""));

    return {
      month,
      prevMonth: shiftMonth(month, -1),
      nextMonth: month < thisMonth ? shiftMonth(month, 1) : null,
      teachers,
      entries: records.map((r) => ({
        reviewedAt: r.reviewedAt,
        email: emails.get(r.reviewerId) ?? null,
        setId: r.setId,
        setTitle: r.setTitle,
        decision: r.decision,
      })),
    };
  }
}
