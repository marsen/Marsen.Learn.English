import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { buildReviewView, type ReviewView } from "./reviewView";

export type GetForReviewResult =
  { ok: true; view: ReviewView } | { ok: false; reason: "forbidden" | "not_found" };

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
    return { ok: true, view: buildReviewView(set, secret, review) };
  }
}
