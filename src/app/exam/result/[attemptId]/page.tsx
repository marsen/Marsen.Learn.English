import type { Metadata } from "next";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ExamResult } from "@/presentation/components/exam/ExamResult";
import { LoginForm } from "@/presentation/components/LoginForm";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { readGuestId } from "@/infrastructure/auth/guestKey";
import { getAttemptResult } from "@/infrastructure/di/examSetContainer";
import { requestLoginCodeAction, verifyLoginCodeAction } from "@/app/actions/auth";

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
    <Page>
      <PageHeader title="批改結果" />
      {!result && <p>找不到這次作答的結果。</p>}
      {result && !result.answerKeyVisible && (
        <section className="mb-8 rounded-xl border border-primary/40 bg-surface p-5">
          <h2 className="font-semibold">想看正解？免費註冊就能看</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            輸入
            email，再輸入信裡的登入碼就完成註冊，這次的作答會保留在你的帳號裡，並看到每題正解。
          </p>
          <LoginForm
            requestCode={requestLoginCodeAction}
            verifyCode={verifyLoginCodeAction}
            submitLabel="寄註冊碼給我"
          />
        </section>
      )}
      {result && <ExamResult result={result} />}
    </Page>
  );
}
