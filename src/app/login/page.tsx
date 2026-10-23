import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { LoginPage as LoginPageContent } from "@/presentation/components/LoginPage";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { requestLoginCodeAction, verifyLoginCodeAction } from "@/app/actions/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("login.title"), robots: { index: false } };
}

export default async function LoginPage() {
  // 已經登入就不用再登入，直接進總覽
  if (await getCurrentAccount()) redirect("/admin");
  return (
    <>
      <DocumentTitle id="login.title" />
      <LoginPageContent
        requestCode={requestLoginCodeAction}
        verifyCode={verifyLoginCodeAction}
      />
    </>
  );
}
