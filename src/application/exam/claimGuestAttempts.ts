import type { AttemptRepository } from "@/domain/exam/attemptRepository";

/**
 * 路人註冊／登入後，把這個瀏覽器先前寫的考卷移到帳號名下（之後就看得到正解、也算進考試紀錄）。
 * 回傳移過去的作答 id（新的在前）。
 */
export class ClaimGuestAttempts {
  constructor(private readonly attempts: AttemptRepository) {}

  async execute(input: { accountId: string; guestId: string | null }): Promise<string[]> {
    if (!input.guestId) return [];
    return this.attempts.claimGuestAttempts(input.guestId, input.accountId);
  }
}
