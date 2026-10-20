import type { Metadata } from "next";
import { ExamResult } from "@/presentation/components/exam/ExamResult";
import { LoginForm } from "@/presentation/components/LoginForm";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { readGuestId } from "@/infrastructure/auth/guestKey";
import { getAttemptResult } from "@/infrastructure/di/examSetContainer";
import { requestLoginLinkAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "批改結果", robots: { index: false } };

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const actor = await getCurrentAccount();
  const guestId = actor ? null : await readGuestId();
  const result = await getAttemptResult().execute({ actor, guestId, attemptId });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <div className="flex gap-4 text-sm">
        <a href="/exam" className="text-muted-foreground underline">
          ← 考卷
        </a>
        {actor && (
          <a href="/exam/history" className="text-muted-foreground underline">
            我的考試紀錄
          </a>
        )}
      </div>
      <h1 className="mt-4 mb-6 font-display text-2xl font-semibold">批改結果</h1>
      {!result && <p>找不到這次作答的結果。</p>}
      {result && !result.answerKeyVisible && (
        <section className="mb-8 rounded-xl border border-primary/40 bg-white p-5">
          <h2 className="font-semibold">想看正解？免費註冊就能看</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            輸入
            email，點信裡的連結就完成註冊，這次的作答會保留在你的帳號裡，並看到每題正解。
          </p>
          <LoginForm action={requestLoginLinkAction} submitLabel="寄註冊連結給我" />
        </section>
      )}
      {result && <ExamResult result={result} />}
    </main>
  );
}
