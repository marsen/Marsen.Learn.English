"use client";

import { useTranslations } from "next-intl";
import { CardPage } from "./ui/Page";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LoginForm } from "./LoginForm";
import type { LoginFormState, VerifyCodeFormState } from "./formStates";

type Props = {
  requestCode: (prev: LoginFormState, formData: FormData) => Promise<LoginFormState>;
  verifyCode: (
    prev: VerifyCodeFormState,
    formData: FormData,
  ) => Promise<VerifyCodeFormState>;
};

/** 登入頁的內容（文字在瀏覽器產生，切換語言時跟著變） */
export function LoginPage({ requestCode, verifyCode }: Props) {
  const t = useTranslations("login");
  return (
    <CardPage
      title={t("title")}
      description={t("description")}
      corner={<LanguageSwitcher />}
    >
      <LoginForm requestCode={requestCode} verifyCode={verifyCode} />
    </CardPage>
  );
}
