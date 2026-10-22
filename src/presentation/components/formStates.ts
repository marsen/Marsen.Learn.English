import type { LoginError } from "@/application/auth/authResult";
import type { ReviewError } from "@/application/examSet/reviewExamSet";

/** 表單狀態型別：由 presentation 定義，app 的 Server Action 照這個回傳。 */
export type LoginFormState = { error?: LoginError; sent?: boolean; devLink?: string };

export type VerifyFormState = { error?: LoginError };

export type UploadSetFormState = {
  problems?: string[];
  uploaded?: { setId: string; title: string; aiVerdict: "pass" | "needs_human" };
};

export type ReviewFormState = {
  problems?: (ReviewError | { code: "notLoggedIn" })[];
  saved?: boolean;
};

export type ManageFormState = { problems?: string[]; saved?: boolean };
