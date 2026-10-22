import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CardPage } from "@/presentation/components/ui/Page";
import { LoginForm } from "@/presentation/components/LoginForm";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { requestLoginLinkAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "登入／註冊", robots: { index: false } };

export default async function LoginPage() {
  // 已經登入就不用再登入，直接進總覽
  if (await getCurrentAccount()) redirect("/admin");
  return (
    <CardPage
      title="登入／註冊"
      description="輸入 email，我們會寄一個登入連結給你，不用密碼。第一次使用會自動建立帳號。"
    >
      <LoginForm action={requestLoginLinkAction} />
    </CardPage>
  );
}
