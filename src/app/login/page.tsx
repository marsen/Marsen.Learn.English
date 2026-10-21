import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/presentation/components/LoginForm";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { requestLoginLinkAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "登入／註冊", robots: { index: false } };

export default async function LoginPage() {
  // 已經登入就不用再登入，直接進總覽
  if (await getCurrentAccount()) redirect("/admin");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8">
        <h1 className="font-display text-2xl font-semibold">登入／註冊</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          輸入 email，我們會寄一個登入連結給你，不用密碼。第一次使用會自動建立帳號。
        </p>
        <LoginForm action={requestLoginLinkAction} />
      </div>
    </main>
  );
}
