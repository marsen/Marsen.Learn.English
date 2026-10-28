import type { LoginError } from "@/application/auth/authResult";
import type { ManageError } from "@/application/account/manageAccounts";
import type { UploadProblem } from "@/application/examSet/examSetResult";
import type { ReviewFormState } from "@/presentation/components/formStates";

/**
 * 錯誤代碼 → 畫面上的文字。後端只回代碼，文字在翻譯檔 errors.*（messages/<語言>.json）。
 * t 是 next-intl 的 useTranslations() / getTranslations() 拿到的函式。
 */
type Translate = (key: string, values?: Record<string, string | number>) => string;

type ReviewFormError = NonNullable<ReviewFormState["problems"]>[number];

type CodedError = { code: string } & Record<string, string | number | string[]>;

/** 代碼帶的值：清單（例如不認得的角色）用翻譯檔的頓號接起來 */
function errorText(t: Translate, group: string, { code, ...values }: CodedError): string {
  const sep = t("common.listSeparator");
  const flat = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.join(sep) : v]),
  );
  return t(`errors.${group}.${code}`, flat);
}

export function loginErrorText(t: Translate, error: LoginError): string {
  return errorText(t, "login", error);
}

export function reviewErrorText(t: Translate, error: ReviewFormError): string {
  return errorText(t, "review", error);
}

export function manageErrorText(t: Translate, error: ManageError): string {
  return errorText(t, "manage", error);
}

export function uploadErrorText(t: Translate, error: UploadProblem): string {
  return errorText(t, "upload", error);
}
