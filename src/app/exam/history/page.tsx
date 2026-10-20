import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AttemptHistory } from "@/presentation/components/exam/AttemptHistory";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listMyAttempts } from "@/infrastructure/di/examSetContainer";

export const metadata: Metadata = { title: "我的考試紀錄", robots: { index: false } };

export default async function HistoryPage() {
  const actor = await requireAccount("/exam/history");
  const records = await listMyAttempts().execute({ actor });
  if (!records) redirect("/admin?denied=1");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <a href="/exam" className="text-sm text-muted-foreground underline">
        ← 考卷
      </a>
      <h1 className="mt-4 mb-6 font-display text-2xl font-semibold">我的考試紀錄</h1>
      <AttemptHistory records={records} />
    </main>
  );
}
