import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import { canTake } from "@/domain/examSet/access";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { ownerOf, rolesOf, type ExamTaker } from "@/application/shared/actor";
import type { StartExamResult } from "./examResult";
import { toPaperView } from "./paperView";

/**
 * 開始考一張考卷：建立一次作答，回傳題目卷與時間軸（不含答案）。
 * 不能考的考卷（不存在、未合格、沒開放給你）一律回 not_available，不透露是哪一種。
 */
export class StartExam {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ExamTaker & { setId: string }): Promise<StartExamResult> {
    const set = await this.sets.findById(input.setId);
    if (!set || !canTake(rolesOf(input.actor), set))
      return { ok: false, reason: "not_available" };
    const owner = ownerOf(input);
    // 路人一定要有瀏覽器識別，不然交卷後沒有人找得回這次作答
    if (!owner.accountId && !owner.guestId) return { ok: false, reason: "not_available" };

    const attempt = await this.attempts.create({
      setId: set.setId,
      ...owner,
      startedAt: this.now(),
    });
    return {
      ok: true,
      sheet: {
        attemptId: attempt.id,
        setId: set.setId,
        title: set.title,
        paper: toPaperView(set.paper),
        timing: set.timing,
      },
    };
  }
}
