"use server";

import type { StartExamResult, SubmitExamResult } from "@/application/exam/examResult";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { startExam, submitExam } from "@/infrastructure/di/examSetContainer";

export async function startExamAction(setId: string): Promise<StartExamResult> {
  return startExam().execute({ actor: await getCurrentAccount(), setId });
}

export async function submitExamAction(
  attemptId: string,
  answers: Record<string, string>,
): Promise<SubmitExamResult> {
  return submitExam().execute({ actor: await getCurrentAccount(), attemptId, answers });
}
