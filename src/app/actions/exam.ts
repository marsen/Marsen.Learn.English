"use server";

import type { StartExamResult, SubmitExamResult } from "@/application/exam/examResult";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { ensureGuestId } from "@/infrastructure/auth/guestKey";
import { startExam, submitExam } from "@/infrastructure/di/examSetContainer";

/** 路人要有瀏覽器識別（cookie），交卷後才找得回、註冊後才移得到帳號名下 */
async function taker() {
  const actor = await getCurrentAccount();
  return { actor, guestId: actor ? null : await ensureGuestId() };
}

export async function startExamAction(setId: string): Promise<StartExamResult> {
  return startExam().execute({ ...(await taker()), setId });
}

export async function submitExamAction(
  attemptId: string,
  answers: Record<string, string>,
): Promise<SubmitExamResult> {
  return submitExam().execute({ ...(await taker()), attemptId, answers });
}
