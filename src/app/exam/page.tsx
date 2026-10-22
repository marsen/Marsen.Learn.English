import type { Metadata } from "next";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ExamList } from "@/presentation/components/exam/ExamList";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { listAvailableExams } from "@/infrastructure/di/examSetContainer";

export const metadata: Metadata = { title: "考卷", robots: { index: false } };

export default async function ExamListPage() {
  const actor = await getCurrentAccount();
  const exams = await listAvailableExams().execute({ actor });

  return (
    <Page width="sm">
      <PageHeader title="雅思聽力 Section 1" />
      <ExamList exams={exams} />
      {!actor && (
        <p className="mt-6 text-sm text-muted-foreground">
          你現在看到的是公開考卷。
          <a href="/login" className="text-primary underline">
            登入
          </a>
          後可以寫更多。
        </p>
      )}
    </Page>
  );
}
