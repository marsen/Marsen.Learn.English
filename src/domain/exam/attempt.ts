import type { GradeResult } from "./grading";

/**
 * 一次作答（純資料）。
 * - 路人的作答沒有帳號（accountId 為 null），靠作答 id（隨機 UUID，猜不到）找回
 * - 交卷後答案就不能再改
 */
export type Attempt = {
  id: string;
  setId: string;
  accountId: string | null;
  /** 路人作答時，那個瀏覽器的識別（雜湊過的）；登入後作答會移到帳號名下 */
  guestId: string | null;
  /** 題號（例如 q01）→ 考生寫的答案 */
  answers: Record<string, string> | null;
  /** 交卷時就批改好的結果 */
  result: GradeResult | null;
  startedAt: Date;
  submittedAt: Date | null;
};

/** 每格答案最多幾個字（擋掉亂塞的資料） */
export const MAX_ANSWER_LENGTH = 100;

/**
 * 這個人能不能動這次作答：
 * - 有帳號的作答只有本人能動
 * - 路人的作答只有當初那個瀏覽器能動（看 guestId），別人拿到網址也看不到
 */
export function ownsAttempt(
  attempt: Attempt,
  who: { accountId: string | null; guestId: string | null },
): boolean {
  if (attempt.accountId !== null) return attempt.accountId === who.accountId;
  return attempt.guestId !== null && attempt.guestId === who.guestId;
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
