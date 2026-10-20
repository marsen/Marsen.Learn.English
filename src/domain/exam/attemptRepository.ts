import type { Attempt } from "./attempt";
import type { GradeResult } from "./grading";

/** 作答儲存的 port。 */
export interface AttemptRepository {
  create(input: {
    setId: string;
    accountId: string | null;
    guestId: string | null;
    startedAt: Date;
  }): Promise<Attempt>;
  findById(id: string): Promise<Attempt | null>;
  /** 交卷（含批改結果）：只有還沒交卷時才寫入；已交卷回傳 false（原子操作） */
  submit(
    id: string,
    answers: Record<string, string>,
    result: GradeResult,
    at: Date,
  ): Promise<boolean>;
  /** 把這個瀏覽器（guestId）的路人作答移到帳號名下；回傳移過去的作答 id（新的在前） */
  claimGuestAttempts(guestId: string, accountId: string): Promise<string[]>;
}
