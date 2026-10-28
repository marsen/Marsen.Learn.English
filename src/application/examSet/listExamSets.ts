import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import { isExamAccess, isExamSetStatus } from "@/domain/examSet/examSet";
import { isAiVerdict } from "@/domain/examSet/bundle";
import type { ExamSetFilter, ExamSetSummary } from "@/domain/examSet/examSetFilter";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";

/** 網址上的過濾參數（?status=&ai=&access=&q=），原樣傳進來 */
export type ExamSetFilterQuery = {
  status?: string;
  ai?: string;
  access?: string;
  q?: string;
};

const MAX_KEYWORD = 100;

/** 網址參數 → 過濾條件；不認得的值當作沒給 */
export function parseExamSetFilter(query: ExamSetFilterQuery): ExamSetFilter {
  const keyword = query.q?.trim().slice(0, MAX_KEYWORD);
  return {
    ...(query.status && isExamSetStatus(query.status) && { status: query.status }),
    ...(isAiVerdict(query.ai) && { aiVerdict: query.ai }),
    ...(isExamAccess(query.access) && { access: query.access }),
    ...(keyword && { keyword }),
  };
}

export type ExamSetListView = { filter: ExamSetFilter; sets: ExamSetSummary[] };

/** 後台題組清單：上傳題目或審稿的人才看得到。 */
export class ListExamSets {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(input: {
    actor: Account;
    query?: ExamSetFilterQuery;
  }): Promise<ExamSetListView | null> {
    const allowed =
      can(input.actor.roles, "uploadSets") || can(input.actor.roles, "reviewSets");
    if (!allowed) return null;
    const filter = parseExamSetFilter(input.query ?? {});
    return { filter, sets: await this.sets.listSummaries(filter) };
  }
}
