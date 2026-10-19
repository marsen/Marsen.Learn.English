/** 表單狀態型別：由 presentation 定義，app 的 Server Action 照這個回傳。 */
export type LoginFormState = { error?: string; sent?: boolean; devLink?: string };

export type VerifyFormState = { error?: string };

export type UploadSetFormState = {
  problems?: string[];
  uploaded?: { setId: string; title: string; aiVerdict: "pass" | "needs_human" };
};
