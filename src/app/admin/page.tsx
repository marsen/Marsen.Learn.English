import type { Metadata } from "next";
import { AccountSummary } from "@/presentation/components/AccountSummary";
import { TeacherDashboard } from "@/presentation/components/dashboard/TeacherDashboard";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { getTeacherDashboard } from "@/infrastructure/di/examSetContainer";

export const metadata: Metadata = { title: "總覽", robots: { index: false } };

/**
 * 總覽：依角色顯示不同內容，優先序 老師 ＞ 管理員 ＞ 學生。
 * 目前做好老師的；其他角色先顯示帳號資訊。
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const account = await requireAccount();
  const { denied } = await searchParams;
  const now = new Date();
  const teacherView = await getTeacherDashboard().execute({ actor: account, now });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
      <h1 className="mb-2 text-2xl font-bold">總覽</h1>
      {denied && (
        <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          你的帳號沒有剛才那個功能的權限。
        </p>
      )}
      {teacherView ? (
        <TeacherDashboard view={teacherView} now={now} />
      ) : (
        <div className="mt-6">
          <AccountSummary account={account} />
        </div>
      )}
    </main>
  );
}
