import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CardPage } from "@/presentation/components/ui/Page";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";
import { LoginForm } from "@/presentation/components/LoginForm";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { requestLoginCodeAction, verifyLoginCodeAction } from "@/app/actions/auth";
import { setLocaleAction } from "@/app/actions/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title"), robots: { index: false } };
}

export default async function LoginPage() {
  // 已經登入就不用再登入，直接進總覽
  if (await getCurrentAccount()) redirect("/admin");
  const t = await getTranslations("login");
  return (
    <CardPage
      title={t("title")}
      description={t("description")}
      footer={<LanguageSwitcher setLocale={setLocaleAction} />}
    >
      <LoginForm
        requestCode={requestLoginCodeAction}
        verifyCode={verifyLoginCodeAction}
      />
    </CardPage>
  );
}
