/**
 * 登入信寄送限制（Resend 免費版每天 100 封，要防止被灌爆）。
 * - 同一個 email：兩封至少隔 60 秒、每小時最多 5 封
 * - 同一個 IP：每小時最多 20 封（換很多 email 灌信，靠這條擋）
 * - 全站最近 24 小時達 95 封：不再寄給還沒有帳號的 email，留額度給已有帳號的人登入
 * - 全站最近 24 小時剛好寄到 50、80 封時通知管理員
 */
export const EMAIL_COOLDOWN_SECONDS = 60;
export const EMAIL_MAX_PER_HOUR = 5;
export const IP_MAX_PER_HOUR = 20;
export const DAILY_SIGNUP_CUTOFF = 95;
export const DAILY_ALERT_THRESHOLDS = [50, 80] as const;
/** Resend 免費版每天上限（寫在通知信裡給管理員參考） */
export const PROVIDER_DAILY_LIMIT = 100;

export const HOUR_MS = 60 * 60_000;
export const DAY_MS = 24 * HOUR_MS;

export type SendFacts = {
  now: Date;
  /** 這個 email 上一封的時間 */
  lastSentToEmail: Date | null;
  /** 這個 email 最近 1 小時寄了幾封 */
  emailSentLastHour: number;
  /** 這個 IP 最近 1 小時寄了幾封；不知道 IP 時為 null（不檢查） */
  ipSentLastHour: number | null;
  /** 全站最近 24 小時寄了幾封 */
  sentLastDay: number;
  /** 這個 email 已經有帳號 */
  hasAccount: boolean;
};

/** 回傳不能寄的原因（中文）；可以寄回 null */
export function sendBlockReason(f: SendFacts): string | null {
  if (f.lastSentToEmail) {
    const waited = (f.now.getTime() - f.lastSentToEmail.getTime()) / 1000;
    if (waited < EMAIL_COOLDOWN_SECONDS) {
      const left = Math.ceil(EMAIL_COOLDOWN_SECONDS - waited);
      return `剛寄過，請等 ${left} 秒再試`;
    }
  }
  if (f.emailSentLastHour >= EMAIL_MAX_PER_HOUR) {
    return "這個 email 這小時寄太多次了，請一小時後再試";
  }
  if (f.ipSentLastHour !== null && f.ipSentLastHour >= IP_MAX_PER_HOUR) {
    return "這個網路這小時申請太多次了，請一小時後再試";
  }
  if (!f.hasAccount && f.sentLastDay >= DAILY_SIGNUP_CUTOFF) {
    return "今天註冊人數已滿，請明天再來";
  }
  return null;
}

/** 寄出這封之後（含這封）的全站 24 小時數量剛好碰到門檻，就回傳門檻值，要通知管理員 */
export function alertThresholdReached(sentLastDayIncludingThis: number): number | null {
  return (DAILY_ALERT_THRESHOLDS as readonly number[]).includes(sentLastDayIncludingThis)
    ? sentLastDayIncludingThis
    : null;
}
