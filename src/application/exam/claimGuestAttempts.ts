import type { AttemptRepository } from "@/domain/exam/attemptRepository";

/**
 * 路人註冊／登入後，把路人作答移到帳號名下（之後就看得到正解、也算進考試紀錄）。
 * guestIds 可以有好幾個來源：申請登入連結的瀏覽器（可能是另一台裝置）、現在點連結的瀏覽器。
 * 重複與 null 會略過。回傳移過去的作答 id（新的在前）。
 */
export class ClaimGuestAttempts {
  constructor(private readonly attempts: AttemptRepository) {}

  async execute(input: {
    accountId: string;
    guestIds: (string | null)[];
  }): Promise<string[]> {
    const guestIds = [...new Set(input.guestIds)].filter((g): g is string => g !== null);
    const ids: string[] = [];
    for (const guestId of guestIds) {
      ids.push(...(await this.attempts.claimGuestAttempts(guestId, input.accountId)));
    }
    if (guestIds.length <= 1) return ids;
    const withTime = await Promise.all(
      ids.map(async (id) => ({
        id,
        t: (await this.attempts.findById(id))?.startedAt.getTime() ?? 0,
      })),
    );
    return withTime.sort((a, b) => b.t - a.t).map((x) => x.id);
  }
}
