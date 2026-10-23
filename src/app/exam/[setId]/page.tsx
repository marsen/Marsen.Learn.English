import type { Metadata } from "next";
import { Page } from "@/presentation/components/ui/Page";
import { ExamRunner } from "@/presentation/components/exam/ExamRunner";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { listAvailableExams } from "@/infrastructure/di/examSetContainer";
import { startExamAction, submitExamAction } from "@/app/actions/exam";

export const metadata: Metadata = { title: "考試", robots: { index: false } };

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
      {exam ? (
        <ExamRunner
          title={exam.title}
          audioUrl={`/exam/${setId}/audio`}
          start={startExamAction.bind(null, setId)}
          submit={submitExamAction}
        />
      ) : (
        <p>
          這張考卷現在不能考。
          {!actor && (
            <>
              {" "}
              <a href="/login" className="text-primary underline">
                登入
              </a>
              後可能可以寫。
            </>
          )}
        </p>
      )}
    </Page>
  );
}
