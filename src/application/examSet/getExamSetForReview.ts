import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { buildReviewView, type ReviewView } from "./reviewView";
import { narratorVoicesOf, type SectionVoices } from "./narratorVoices";

export type GetForReviewResult =
  | {
      ok: true;
      view: ReviewView;
      /** 錄音旁白用的聲音：只給管理員，其他人（只有老師身分）是 null */
      voices: SectionVoices[] | null;
    }
  | { ok: false; reason: "forbidden" | "not_found" };

/** 審稿頁資料（含標準答案）：只有「審稿」權限的帳號拿得到。 */
export class GetExamSetForReview {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(input: { actor: Account; setId: string }): Promise<GetForReviewResult> {
    if (!can(input.actor.roles, "reviewSets")) return { ok: false, reason: "forbidden" };
    const [set, secret, review] = await Promise.all([
      this.sets.findById(input.setId),
      this.sets.findPrivate(input.setId),
      this.sets.findReview(input.setId),
    ]);
    if (!set || !secret) return { ok: false, reason: "not_found" };
    const view = buildReviewView(set, secret, review);
    const voices = can(input.actor.roles, "uploadSets")
      ? narratorVoicesOf(secret, view.fullPaper !== null)
      : null;
    return { ok: true, view, voices };
  }
}
