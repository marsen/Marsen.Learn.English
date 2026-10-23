import type { LoginError } from "@/application/auth/authResult";
import type { ReviewFormState } from "@/presentation/components/formStates";

/**
 * 錯誤代碼 → 畫面上的文字。後端只回代碼，文字在翻譯檔 errors.*（messages/<語言>.json）。
 * t 是 next-intl 的 useTranslations() / getTranslations() 拿到的函式。
 */
type Translate = (key: string, values?: Record<string, string | number>) => string;

type ReviewFormError = NonNullable<ReviewFormState["problems"]>[number];

export function loginErrorText(t: Translate, { code, ...values }: LoginError): string {
  return t(`errors.login.${code}`, values);
}

export function reviewErrorText(
  t: Translate,
  { code, ...values }: ReviewFormError,
): string {
  return t(`errors.review.${code}`, values);
}

/** 題組已刪除時顯示的名稱 */
export const DELETED_SET_TITLE = "（已刪除的題組）";
