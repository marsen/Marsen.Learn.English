import type { Metadata } from "next";
import { LoginForm } from "@/presentation/components/LoginForm";
import { requestLoginLinkAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "登入", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8">
        <h1 className="font-display text-2xl font-semibold">登入</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          輸入 email，我們會寄一個登入連結給你，不用密碼。
        </p>
        <LoginForm action={requestLoginLinkAction} />
      </div>
    </main>
  );
}
