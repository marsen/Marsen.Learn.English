import { createHmac } from "node:crypto";

/**
 * 錄音通行證（給 Cloudflare Workers 的 audio-gate 驗證）。
 * 簽名內容是「錄音 key:到期時間（秒）」，用 HMAC-SHA256，密鑰只有網站和 Workers 知道。
 * 驗證的那一半在 workers/audio-gate/src/pass.ts，兩邊格式要一致。
 */
export function signAudioPass(key: string, exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`${key}:${exp}`).digest("hex");
}

const DAY_SECONDS = 24 * 60 * 60;

/**
 * 到期時間：後天 00:00（UTC）。
 * 同一天拿到的通行證都一樣，瀏覽器快取才用得上；有效期在 24～48 小時之間。
 */
export function audioPassExpiry(nowMs: number): number {
  return (Math.floor(nowMs / 1000 / DAY_SECONDS) + 2) * DAY_SECONDS;
}
