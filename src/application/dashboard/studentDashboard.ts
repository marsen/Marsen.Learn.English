import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import { canTake } from "@/domain/examSet/access";
import type { ExamSet } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AttemptRepository } from "@/domain/exam/attemptRepository";
import { trapsOf } from "@/application/examSet/reviewView";

export type Recommendation = {
  setId: string;
  title: string;
  questionCount: number;
  /** new：還沒考過；retry：都考過了，挑分數最低的再挑戰 */
  reason: "new" | "retry";
  /** retry 時，這套最好的成績（百分比） */
  bestPercent: number | null;
};

export type RecentScore = {
  attemptId: string;
  /** 題組已刪除時為 null */
  title: string | null;
  score: number;
  total: number;
  submittedAt: Date;
};

export type WeakTrap = {
  /** 陷阱類型（例如 spelling），畫面再轉成中文 */
  trap: string;
  wrong: number;
  seen: number;
};

export type StudentDashboardView = {
  recommendation: Recommendation | null;
  /** 能考但還沒考過的張數 */
  notTakenCount: number;
  /** 交卷次數 */
  attemptCount: number;
  /** 所有交卷的平均分數（百分比，四捨五入）；還沒考過是 null */
  averagePercent: number | null;
  /** 最近 5 次，舊的在前（畫走勢用） */
  recent: RecentScore[];
  /** 最常錯的題型，錯最多的在前，最多 3 個 */
  weakTraps: WeakTrap[];
};

const percent = (score: number, total: number) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

/** 學生的總覽：有考試紀錄權限才看得到。 */
export class GetStudentDashboard {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly attempts: AttemptRepository,
  ) {}

  async execute(input: { actor: Account }): Promise<StudentDashboardView | null> {
    if (!can(input.actor.roles, "keepRecords")) return null;

    const [allSets, submitted] = await Promise.all([
      this.sets.list(),
      this.attempts.listSubmittedByAccount(input.actor.id),
    ]);
    const done = submitted.filter((a) => a.result !== null);
    const byId = new Map(allSets.map((s) => [s.setId, s]));
    const available = allSets.filter((s) => canTake(input.actor.roles, s));
    const taken = new Set(done.map((a) => a.setId));
    const notTaken = available.filter((s) => !taken.has(s.setId));

    // 每套最好的成績
    const best = new Map<string, number>();
    for (const a of done) {
      const p = percent(a.result!.score, a.result!.total);
      best.set(a.setId, Math.max(best.get(a.setId) ?? 0, p));
    }

    const recommendation = recommend(notTaken, available, best);

    const totalScore = done.reduce((n, a) => n + a.result!.score, 0);
    const totalQuestions = done.reduce((n, a) => n + a.result!.total, 0);

    const recent = done
      .slice(0, 5)
      .reverse()
      .map((a) => ({
        attemptId: a.id,
        title: byId.get(a.setId)?.title ?? null,
        score: a.result!.score,
        total: a.result!.total,
        submittedAt: a.submittedAt!,
      }));

    return {
      recommendation,
      notTakenCount: notTaken.length,
      attemptCount: done.length,
      averagePercent: done.length > 0 ? percent(totalScore, totalQuestions) : null,
      recent,
      weakTraps: await this.weakTraps(done),
    };
  }

  /** 依每一題的陷阱類型，算出錯最多的題型（沒有陷阱的題目不算） */
  private async weakTraps(
    done: {
      setId: string;
      result: { results: { questionId: string; correct: boolean }[] } | null;
    }[],
  ): Promise<WeakTrap[]> {
    const trapsBySet = new Map<string, Map<string, string | null>>();
    const tally = new Map<string, { wrong: number; seen: number }>();
    for (const a of done) {
      if (!trapsBySet.has(a.setId)) {
        const secret = await this.sets.findPrivate(a.setId);
        trapsBySet.set(a.setId, secret ? trapsOf(secret.answers) : new Map());
      }
      const traps = trapsBySet.get(a.setId)!;
      for (const r of a.result?.results ?? []) {
        const trap = traps.get(r.questionId);
        if (!trap || trap === "none") continue;
        const t = tally.get(trap) ?? { wrong: 0, seen: 0 };
        t.seen += 1;
        if (!r.correct) t.wrong += 1;
        tally.set(trap, t);
      }
    }
    return [...tally.entries()]
      .map(([trap, t]) => ({ trap, ...t }))
      .filter((t) => t.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong || b.wrong / b.seen - a.wrong / a.seen)
      .slice(0, 3);
  }
}

/** 先推還沒考過的（最新上架的）；都考過了就推分數最低的那套再挑戰 */
function recommend(
  notTaken: ExamSet[],
  available: ExamSet[],
  best: Map<string, number>,
): Recommendation | null {
  const fresh = notTaken[0];
  if (fresh)
    return {
      setId: fresh.setId,
      title: fresh.title,
      questionCount: fresh.questionCount,
      reason: "new",
      bestPercent: null,
    };
  const retry = [...available].sort(
    (a, b) => (best.get(a.setId) ?? 0) - (best.get(b.setId) ?? 0),
  )[0];
  if (!retry) return null;
  return {
    setId: retry.setId,
    title: retry.title,
    questionCount: retry.questionCount,
    reason: "retry",
    bestPercent: best.get(retry.setId) ?? null,
  };
}
