import type { Metadata } from "next";
import { AccountSummary } from "@/presentation/components/AccountSummary";
import { AdminDashboard } from "@/presentation/components/dashboard/AdminDashboard";
import { TeacherDashboard } from "@/presentation/components/dashboard/TeacherDashboard";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import {
  getAdminDashboard,
  getTeacherDashboard,
} from "@/infrastructure/di/examSetContainer";
import { deleteExamSetAction, setExamAccessAction } from "@/app/actions/examSet";

export const metadata: Metadata = { title: "總覽", robots: { index: false } };

/**
 * 總覽：依角色顯示不同內容，優先序 老師 ＞ 管理員 ＞ 學生。
 * 同時是老師和管理員的帳號兩塊都看得到（老師的在上面）。學生的還沒做，先顯示帳號資訊。
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const account = await requireAccount();
  const { denied } = await searchParams;
  const now = new Date();
  const [teacherView, adminView] = await Promise.all([
    getTeacherDashboard().execute({ actor: account, now }),
    getAdminDashboard().execute({ actor: account }),
  ]);
  const both = teacherView && adminView;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
      <h1 className="mb-2 text-2xl font-bold">總覽</h1>
      {denied && (
        <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          你的帳號沒有剛才那個功能的權限。
        </p>
      )}
      {teacherView && (
        <>
          {both && <h2 className="mt-6 text-xl font-semibold">審稿</h2>}
          <TeacherDashboard view={teacherView} now={now} />
        </>
      )}
      {adminView && (
        <div className={both ? "mt-16 border-t border-border pt-10" : "mt-6"}>
          {both && <h2 className="mb-6 text-xl font-semibold">管理</h2>}
          <AdminDashboard
            view={adminView}
            setAccessAction={setExamAccessAction}
            deleteAction={deleteExamSetAction}
          />
        </div>
      )}
      {!teacherView && !adminView && (
        <div className="mt-6">
          <AccountSummary account={account} />
        </div>
      )}
    </main>
  );
}
