import type { Metadata } from "next";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <a href="/exam" className="text-sm text-muted-foreground underline">
        ← 考卷
      </a>
      {exam ? (
        <div className="mt-4">
          <ExamRunner
            title={exam.title}
            audioUrl={`/exam/${setId}/audio`}
            start={startExamAction.bind(null, setId)}
            submit={submitExamAction}
          />
        </div>
      ) : (
        <p className="mt-6">
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
    </main>
  );
}
