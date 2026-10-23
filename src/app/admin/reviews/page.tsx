import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ReviewLog } from "@/presentation/components/admin/ReviewLog";
import { requirePermission } from "@/infrastructure/auth/currentAccount";
import { getReviewLog } from "@/infrastructure/di/examSetContainer";

export const metadata: Metadata = { title: "審稿紀錄", robots: { index: false } };

export default async function ReviewLogPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const actor = await requirePermission("viewReviewLog");
  const { month } = await searchParams;
  const view = await getReviewLog().execute({ actor, month, now: new Date() });
  if (!view) redirect("/admin?denied=1");

  return (
    <Page width="lg">
      <PageHeader
        title="審稿紀錄"
        description="每送出一次審稿就記一筆，改判或刪掉題組都不會不見。月份照台灣時間算。"
      />
      <ReviewLog view={view} />
    </Page>
  );
}
