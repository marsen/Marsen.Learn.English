import type { Account } from "@/domain/account/account";
import type { AccountRepository } from "@/domain/account/accountRepository";
import { can } from "@/domain/account/permission";
import type { ExamSet } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { QuestionNote, TeacherReview } from "@/domain/examSet/review";

export type ReviewedSetView = {
  set: ExamSet;
  /** 審稿老師的 email；帳號找不到就是 null */
  reviewerEmail: string | null;
  reviewedAt: Date | null;
};

export type RejectedSetView = ReviewedSetView & {
  comment: string | null;
  audioNote: string | null;
  questionNotes: QuestionNote[];
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
      const review: TeacherReview | null = await this.sets.findReview(set.setId);
      return {
        set,
        review,
        reviewerEmail: review ? await emailOf(review.reviewerId) : null,
        reviewedAt: review?.reviewedAt ?? null,
      };
    };
    const time = (d: Date | null) => d?.getTime() ?? 0;

    const readyToList = (await Promise.all(ready.map(withReview)))
      .sort((a, b) => time(a.reviewedAt) - time(b.reviewedAt))
      .map(({ set, reviewerEmail, reviewedAt }) => ({ set, reviewerEmail, reviewedAt }));

    const rejectedViews = (await Promise.all(rejected.map(withReview)))
      .sort((a, b) => time(b.reviewedAt) - time(a.reviewedAt))
      .map(({ set, review, reviewerEmail, reviewedAt }) => ({
        set,
        reviewerEmail,
        reviewedAt,
        comment: review?.comment ?? null,
        audioNote: review?.audioNote ?? null,
        questionNotes: review?.questionNotes ?? [],
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

/** 把老師的退回意見整理成一段文字，方便管理員貼給 AI */
export function feedbackText(v: RejectedSetView): string {
  const lines = [`題組 ${v.set.setId}（${v.set.title}）老師審稿退回。`];
  if (v.comment) lines.push(`整體意見：${v.comment}`);
  if (v.audioNote) lines.push(`錄音建議：${v.audioNote}`);
  if (v.questionNotes.length > 0) {
    lines.push("各題建議：");
    for (const n of v.questionNotes) lines.push(`- ${n.questionId}：${n.note}`);
  }
  return lines.join("\n");
}
