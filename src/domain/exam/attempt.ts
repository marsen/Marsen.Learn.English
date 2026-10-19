/**
 * 一次作答（純資料）。
 * - 路人的作答沒有帳號（accountId 為 null），靠作答 id（隨機 UUID，猜不到）找回
 * - 交卷後答案就不能再改
 */
export type Attempt = {
  id: string;
  setId: string;
  accountId: string | null;
  /** 題號（例如 q01）→ 考生寫的答案 */
  answers: Record<string, string> | null;
  startedAt: Date;
  submittedAt: Date | null;
};

/** 每格答案最多幾個字（擋掉亂塞的資料） */
export const MAX_ANSWER_LENGTH = 100;

/** 這個人能不能動這次作答：有帳號的作答只有本人能動；路人的作答拿得到 id 就能動 */
export function ownsAttempt(attempt: Attempt, accountId: string | null): boolean {
  return attempt.accountId === null || attempt.accountId === accountId;
}

/** 整理交卷內容：只收這張考卷的題號，去頭尾空白、截斷過長的答案，沒寫的題目記成空字串 */
export function normalizeAnswers(
  raw: Record<string, unknown>,
  questionIds: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of questionIds) {
    const v = raw[id];
    out[id] = typeof v === "string" ? v.trim().slice(0, MAX_ANSWER_LENGTH) : "";
  }
  return out;
}
