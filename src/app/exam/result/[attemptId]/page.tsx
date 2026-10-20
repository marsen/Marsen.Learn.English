import type { Metadata } from "next";
import { ExamResult } from "@/presentation/components/exam/ExamResult";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { getAttemptResult } from "@/infrastructure/di/examSetContainer";

export const metadata: Metadata = { title: "批改結果", robots: { index: false } };

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const actor = await getCurrentAccount();
  const result = await getAttemptResult().execute({ actor, attemptId });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <a href="/exam" className="text-sm text-muted-foreground underline">
        ← 考卷
      </a>
      <h1 className="mt-4 mb-6 font-display text-2xl font-semibold">批改結果</h1>
      {result ? <ExamResult result={result} /> : <p>找不到這次作答的結果。</p>}
      {!actor && result && (
        <p className="mt-6 text-sm text-muted-foreground">
          這是試寫的結果，不會留下紀錄。
          <a href="/login" className="text-primary underline">
            登入
          </a>
          後可以寫更多考卷。
        </p>
      )}
    </main>
  );
}
