import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Page } from "@/presentation/components/ui/Page";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { RichMsg } from "@/presentation/components/RichMsg";
import { ExamRunner } from "@/presentation/components/exam/ExamRunner";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { listAvailableExams } from "@/infrastructure/di/examSetContainer";
import { startExamAction, submitExamAction } from "@/app/actions/exam";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("exam");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ExamPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;
  const actor = await getCurrentAccount();
  // 只用來決定要不要顯示「開始考試」；真正的權限檢查在 StartExam
  const exam = (await listAvailableExams().execute({ actor })).find(
    (e) => e.setId === setId,
  );

  return (
    <Page>
      <DocumentTitle id="exam.metaTitle" />
      {exam ? (
        <ExamRunner
          title={exam.title}
          audioUrl={`/exam/${setId}/audio`}
          start={startExamAction.bind(null, setId)}
          submit={submitExamAction}
        />
      ) : (
        <p>
          <RichMsg id={actor ? "exam.errors.unavailable" : "exam.unavailableGuest"} />
        </p>
      )}
    </Page>
  );
}
