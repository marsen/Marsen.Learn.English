import type { Account } from "@/domain/account/account";
import type { AccountRepository } from "@/domain/account/accountRepository";
import { can } from "@/domain/account/permission";
import type { ExamSet, ExamSetPrivate } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { ReviewNote, TeacherReview } from "@/domain/examSet/review";
import { buildReviewView } from "@/application/examSet/reviewView";
import { reviewFeedback } from "./reviewFeedback";

export type ReviewedSetView = {
  set: ExamSet;
  /** 給 AI 看的完整回饋（題目、答案、AI 與老師的意見、逐字稿），管理員一鍵複製 */
  feedback: string;
  /** 審稿老師的 email；帳號找不到就是 null */
  reviewerEmail: string | null;
  reviewedAt: Date | null;
};

export type RejectedSetView = ReviewedSetView & {
  comment: string | null;
  /** 老師的意見；target 是題號，null＝整套／錄音 */
  notes: ReviewNote[];
};

export type AdminDashboardView = {
  counts: {
    /** 等老師審 */
    pending: number;
    /** 老師通過、還是下架 */
    readyToList: number;
    /** 老師退回 */
    rejected: number;
    /** 上架中（給會員） */
    listed: number;
    /** 公開試考 */
    public: number;
  };
  /** 可以上架：老師通過、還是下架（審完最久的在前） */
  readyToList: ReviewedSetView[];
  /** 有問題：老師退回（最近退回的在前） */
  rejected: RejectedSetView[];
};

/** 管理員的總覽：有設定開放對象（上架）權限才看得到。 */
export class GetAdminDashboard {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(input: { actor: Account }): Promise<AdminDashboardView | null> {
    if (!can(input.actor.roles, "setExamAccess")) return null;

    const all = await this.sets.list();
    const approved = all.filter((s) => s.status === "approved");
    const ready = approved.filter((s) => s.access === "unlisted");
    const rejected = all.filter((s) => s.status === "rejected");

    const emails = new Map<string, string | null>();
    const emailOf = async (id: string) => {
      if (!emails.has(id))
        emails.set(id, (await this.accounts.findById(id))?.email ?? null);
      return emails.get(id) ?? null;
    };
    const withReview = async (set: ExamSet) => {
      const [review, secret] = await Promise.all([
        this.sets.findReview(set.setId),
        this.sets.findPrivate(set.setId),
      ]);
      const reviewerEmail = review ? await emailOf(review.reviewerId) : null;
      return {
        set,
        review,
        reviewerEmail,
        reviewedAt: review?.reviewedAt ?? null,
        feedback: feedbackOf(set, secret, review, reviewerEmail),
      };
    };
    const time = (d: Date | null) => d?.getTime() ?? 0;

    const readyToList = (await Promise.all(ready.map(withReview)))
      .sort((a, b) => time(a.reviewedAt) - time(b.reviewedAt))
      .map(({ set, reviewerEmail, reviewedAt, feedback }) => ({
        set,
        reviewerEmail,
        reviewedAt,
        feedback,
      }));

    const rejectedViews = (await Promise.all(rejected.map(withReview)))
      .sort((a, b) => time(b.reviewedAt) - time(a.reviewedAt))
      .map(({ set, review, reviewerEmail, reviewedAt, feedback }) => ({
        set,
        reviewerEmail,
        reviewedAt,
        feedback,
        comment: review?.comment ?? null,
        notes: review?.notes ?? [],
      }));

    return {
      counts: {
        pending: all.filter((s) => s.status === "pending_review").length,
        readyToList: ready.length,
        rejected: rejected.length,
        listed: approved.filter((s) => s.access === "members").length,
        public: approved.filter((s) => s.access === "public").length,
      },
      readyToList,
      rejected: rejectedViews,
    };
  }
}

/** 完整回饋；題組資料格式不對（整理不出審稿頁）時，退而只給老師寫的意見 */
function feedbackOf(
  set: ExamSet,
  secret: ExamSetPrivate | null,
  review: TeacherReview | null,
  reviewerEmail: string | null,
): string {
  if (secret) {
    try {
      return reviewFeedback(buildReviewView(set, secret, review), reviewerEmail);
    } catch {
      // 落到下面的簡短版
    }
  }
  const lines = [`# Teacher review: ${set.setId} (${set.title})`];
  if (review?.comment) lines.push(`Overall comment: ${review.comment}`);
  for (const n of review?.notes ?? [])
    lines.push(`- [${n.target ?? "whole set"}] ${n.text}`);
  return lines.join("\n");
}
