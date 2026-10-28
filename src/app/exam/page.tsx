import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { RichMsg } from "@/presentation/components/RichMsg";
import { ExamList } from "@/presentation/components/exam/ExamList";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { listAvailableExams } from "@/infrastructure/di/examSetContainer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("examList");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ExamListPage() {
  const actor = await getCurrentAccount();
  const exams = await listAvailableExams().execute({ actor });

  return (
    <Page width="sm">
      <DocumentTitle id="examList.metaTitle" />
      <PageHeader title={<Msg id="examList.title" />} />
      <ExamList exams={exams} />
      {!actor && (
        <p className="mt-6 text-sm text-muted-foreground">
          <RichMsg id="examList.guestHint" />
        </p>
      )}
    </Page>
  );
}
