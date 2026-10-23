import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { AttemptHistory } from "@/presentation/components/exam/AttemptHistory";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listMyAttempts } from "@/infrastructure/di/examSetContainer";

export const metadata: Metadata = { title: "我的考試紀錄", robots: { index: false } };

export default async function HistoryPage() {
  const actor = await requireAccount("/exam/history");
  const records = await listMyAttempts().execute({ actor });
  if (!records) redirect("/admin?denied=1");

  return (
    <Page>
      <PageHeader title="我的考試紀錄" />
      <AttemptHistory records={records} />
    </Page>
  );
}
