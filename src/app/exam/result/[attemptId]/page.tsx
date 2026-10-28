import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { ExamResult } from "@/presentation/components/exam/ExamResult";
import { LoginForm } from "@/presentation/components/LoginForm";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { readGuestId } from "@/infrastructure/auth/guestKey";
import { getAttemptResult } from "@/infrastructure/di/examSetContainer";
import { requestLoginCodeAction, verifyLoginCodeAction } from "@/app/actions/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("result");
  return { title: t("title"), robots: { index: false } };
}

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
      <DocumentTitle id="result.title" />
      <PageHeader title={<Msg id="result.title" />} />
      {!result && (
        <p>
          <Msg id="result.notFound" />
        </p>
      )}
      {result && !result.answerKeyVisible && (
        <section className="mb-8 rounded-xl border border-primary/40 bg-surface p-5">
          <h2 className="font-semibold">
            <Msg id="result.signupTitle" />
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            <Msg id="result.signupBody" />
          </p>
          <LoginForm
            requestCode={requestLoginCodeAction}
            verifyCode={verifyLoginCodeAction}
            submitLabelId="result.sendSignupCode"
          />
        </section>
      )}
      {result && <ExamResult result={result} />}
    </Page>
  );
}
