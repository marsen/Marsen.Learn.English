import type { Metadata } from "next";
import { AccountSummary } from "@/presentation/components/AccountSummary";
import { can } from "@/domain/account/permission";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "後台", robots: { index: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const account = await requireAccount();
  const { denied } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">後台</h1>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-muted-foreground underline">
            登出
          </button>
        </form>
      </div>
      {denied && (
        <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          你的帳號沒有剛才那個功能的權限。
        </p>
      )}
      {(can(account.roles, "uploadSets") || can(account.roles, "reviewSets")) && (
        <a
          href="/admin/sets"
          className="mb-8 block rounded-xl border border-border bg-white p-4"
        >
          題組 →
        </a>
      )}
      {can(account.roles, "manageRoles") && (
        <a
          href="/admin/accounts"
          className="mb-8 block rounded-xl border border-border bg-white p-4"
        >
          管理權限 →
        </a>
      )}
      {can(account.roles, "takeExam") && (
        <a
          href="/exam"
          className="mb-8 block rounded-xl border border-border bg-white p-4"
        >
          考卷 →
        </a>
      )}
      <AccountSummary account={account} />
    </main>
  );
}
