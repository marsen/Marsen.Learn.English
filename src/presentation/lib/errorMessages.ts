import type { LoginError } from "@/application/auth/authResult";
import type { ReviewFormState } from "@/presentation/components/formStates";

/**
 * 錯誤代碼 → 畫面上的文字（老師、學生、路人會看到的）。
 * 後端只回代碼，文字一律在這裡；之後多語系只要換這裡的文字來源。
 */
export function loginErrorText(e: LoginError): string {
  switch (e.code) {
    case "invalidEmail":
      return "email 格式不對";
    case "malformedCode":
      return "登入碼是 6 位數字";
    case "wrongCode":
      return `登入碼不對，還可以再試 ${e.remaining} 次`;
    case "codeExpired":
      return "這組登入碼已經失效（過期、用過或輸錯太多次），請重新寄一組";
    case "cooldown":
      return `剛寄過，請等 ${e.seconds} 秒再試`;
    case "emailHourlyLimit":
      return "這個 email 這小時寄太多次了，請一小時後再試";
    case "ipHourlyLimit":
      return "這個網路這小時申請太多次了，請一小時後再試";
    case "signupsFull":
      return "今天註冊人數已滿，請明天再來";
  }
}

type ReviewFormError = NonNullable<ReviewFormState["problems"]>[number];

export function reviewErrorText(e: ReviewFormError): string {
  switch (e.code) {
    case "notLoggedIn":
      return "請先登入";
    case "forbidden":
      return "你的帳號沒有審稿的權限";
    case "setNotFound":
      return "找不到這套題";
    case "decisionRequired":
      return "請選擇合格或不合格";
    case "commentTooLong":
      return `整體意見最多 ${e.max} 字`;
    case "audioNoteTooLong":
      return `錄音建議最多 ${e.max} 字`;
    case "unknownQuestion":
      return `沒有這一題：${e.questionId}`;
    case "questionNoteTooLong":
      return `${e.questionId} 的建議最多 ${e.max} 字`;
  }
}

/** 題組已刪除時顯示的名稱 */
export const DELETED_SET_TITLE = "（已刪除的題組）";
