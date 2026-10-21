import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
      <h1 className="mb-1 text-2xl font-bold">審稿紀錄</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        每送出一次審稿就記一筆，改判或刪掉題組都不會不見。月份照台灣時間算。
      </p>
      <ReviewLog view={view} />
    </main>
  );
}
