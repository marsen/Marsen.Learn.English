import type { LoginError } from "@/application/auth/authResult";
import type { ReviewError } from "@/application/examSet/reviewExamSet";
import type {
  ExistingSet,
  UploadOutcome,
  UploadProblem,
} from "@/application/examSet/examSetResult";
import type { ManageError } from "@/application/account/manageAccounts";

/** 表單狀態型別：由 presentation 定義，app 的 Server Action 照這個回傳。 */
/** 申請登入碼：寄出後記下寄到哪個 email；開發模式（沒有寄信服務）會直接給登入碼 */
export type LoginFormState = {
  error?: LoginError;
  /** 剛剛送出的 email（失敗時用來保留輸入） */
  email?: string;
  sentTo?: string;
  /** 寄出的時間（毫秒）；每寄一次都不同，畫面用它重設輸入登入碼的步驟 */
  sentAt?: number;
  devCode?: string;
};

/** 輸入登入碼：成功會直接轉頁，所以只有錯誤 */
export type VerifyCodeFormState = { error?: LoginError };

export type UploadSetFormState = {
  problems?: UploadProblem[];
  /** 同一個 set_id 已經有了，等使用者決定要不要覆蓋 */
  existing?: ExistingSet;
  uploaded?: {
    setId: string;
    title: string;
    aiVerdict: "pass" | "needs_human";
    outcome: UploadOutcome;
  };
};

export type ReviewFormState = {
  /** submitFailed：連不到網站（斷網等），由審稿頁自己接住 action 的例外 */
  problems?: (ReviewError | { code: "notLoggedIn" } | { code: "submitFailed" })[];
  saved?: boolean;
};

export type ManageFormState = { problems?: ManageError[]; saved?: boolean };
