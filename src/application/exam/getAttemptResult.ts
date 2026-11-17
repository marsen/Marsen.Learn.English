import { can } from "@/domain/account/permission";
import { ownsAttempt } from "@/domain/exam/attempt";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { ownerOf, rolesOf, type ExamTaker } from "@/application/shared/actor";
import type { AttemptResultView } from "./examResult";
import { estimatedBand, sectionRangesOf, sectionScores } from "@/domain/examSet/fullExam";

/**
 * 看批改結果：要有「看批改結果」權限，而且是自己的作答（路人只能看自己這個瀏覽器的）。
 * 沒有「看正解」權限（路人）就把正解拿掉：只看得到分數與每題對錯。
 * 看不到一律回 null，不透露作答存不存在。
 */
export class GetAttemptResult {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
  ) {}

  async execute(
    input: ExamTaker & { attemptId: string },
  ): Promise<AttemptResultView | null> {
    const roles = rolesOf(input.actor);
    if (!can(roles, "viewResult")) return null;
    const attempt = await this.attempts.findById(input.attemptId);
    if (!attempt || !ownsAttempt(attempt, ownerOf(input))) return null;
    if (!attempt.result || !attempt.submittedAt) return null;
    const set = await this.sets.findById(attempt.setId);
    const answerKeyVisible = can(roles, "viewAnswerKey");
    // 完整考卷：各段答對幾題、級分都在讀取時算（作答紀錄的形狀和 2.x 一樣）
    // 同一個 set_id 從 2.x 覆蓋成完整考卷時，舊的作答只有部分段落：有段落一題都沒有就不分段、不換算
    const ranges = set ? sectionRangesOf(set.paper) : [];
    const scores = sectionScores(ranges, attempt.result.results);
    const isFull = scores.length > 0 && scores.every((s) => s.total > 0);
    return {
      attemptId: attempt.id,
      setId: attempt.setId,
      title: set?.title ?? attempt.setId,
      submittedAt: attempt.submittedAt,
      score: attempt.result.score,
      total: attempt.result.total,
      answerKeyVisible,
      results: attempt.result.results.map((r) =>
        answerKeyVisible ? r : { ...r, expected: null, accepted: [] },
      ),
      sections: isFull ? scores : [],
      band: isFull ? estimatedBand(attempt.result.score, attempt.result.total) : null,
    };
  }
}
