import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { AttemptHistory } from "@/presentation/components/exam/AttemptHistory";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listMyAttempts } from "@/infrastructure/di/examSetContainer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("history");
  return { title: t("title"), robots: { index: false } };
}

export default async function HistoryPage() {
  const actor = await requireAccount("/exam/history");
  const records = await listMyAttempts().execute({ actor });
  if (!records) redirect("/admin?denied=1");

  return (
    <Page>
      <DocumentTitle id="history.title" />
      <PageHeader title={<Msg id="history.title" />} />
      <AttemptHistory records={records} />
    </Page>
  );
}
