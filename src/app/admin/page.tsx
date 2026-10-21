import type { Metadata } from "next";
import { AccountSummary } from "@/presentation/components/AccountSummary";
import { requireAccount } from "@/infrastructure/auth/currentAccount";

export const metadata: Metadata = { title: "總覽", robots: { index: false } };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const account = await requireAccount();
  const { denied } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <h1 className="mb-8 text-2xl font-bold">總覽</h1>
      {denied && (
        <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          你的帳號沒有剛才那個功能的權限。
        </p>
      )}
      <AccountSummary account={account} />
    </main>
  );
}
