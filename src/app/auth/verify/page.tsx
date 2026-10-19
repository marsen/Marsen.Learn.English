import type { Metadata } from "next";
import { VerifyForm } from "@/presentation/components/VerifyForm";
import { verifyLoginLinkAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "完成登入", robots: { index: false } };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8">
        <h1 className="font-display text-2xl font-semibold">完成登入</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">按下按鈕就登入了。</p>
        <VerifyForm token={token} action={verifyLoginLinkAction} />
      </div>
    </main>
  );
}
