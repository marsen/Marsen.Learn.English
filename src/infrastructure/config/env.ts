/**
 * 集中管理環境變數（infrastructure/config）。
 * - 模組載入時就用 Zod 驗證，缺必要變數立刻拋錯（fail-fast）。
 * - 不在程式裡寫預設值；預設值放 .env.local / .env.example。
 * - 其他模組一律 import `env`，不直接讀 process.env。
 */
import { z } from "zod";

const schema = z.object({
  // 站台對外網址，登入連結用它組出來
  SITE_URL: z.string().url(),
  // 資料庫（Neon）；本機和正式環境都一定要有，沒有就啟動失敗
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_TOKEN_TTL: z.string().min(1),
  // 寄信（Resend）；沒設定時改用開發用寄信（只限非正式環境）
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  // 本機開發：上傳的音檔存在這個資料夾（相對專案根目錄）；沒設定 R2 時一定要有
  AUDIO_LOCAL_DIR: z.string().min(1).optional(),
  // 錄音存 Cloudflare R2（四個要一起設定）；有設定就優先用 R2
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  // 錄音經 Cloudflare 各地節點送出（workers/audio-gate）；要先設定 R2，兩個要一起設定
  AUDIO_CDN_BASE: z.string().url().optional(),
  AUDIO_PASS_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = Object.keys(parsed.error.flatten().fieldErrors);
  throw new Error(
    `[env] Missing or invalid environment variables: ${missing.join(", ")}`,
  );
}

const _env = parsed.data;

const r2Values = [
  _env.R2_ACCOUNT_ID,
  _env.R2_ACCESS_KEY_ID,
  _env.R2_SECRET_ACCESS_KEY,
  _env.R2_BUCKET,
];
if (r2Values.some(Boolean) && !r2Values.every(Boolean)) {
  throw new Error(
    "[env] R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET 要一起設定",
  );
}
if (Boolean(_env.AUDIO_CDN_BASE) !== Boolean(_env.AUDIO_PASS_SECRET)) {
  throw new Error("[env] AUDIO_CDN_BASE、AUDIO_PASS_SECRET 要一起設定");
}
if (_env.AUDIO_CDN_BASE && !r2Values.every(Boolean)) {
  throw new Error("[env] 用 AUDIO_CDN_BASE 之前要先設定 R2（錄音存在 R2）");
}

export const env = {
  siteUrl: _env.SITE_URL,
  databaseUrl: _env.DATABASE_URL,
  authSecret: _env.AUTH_SECRET,
  authTokenTtl: _env.AUTH_TOKEN_TTL,
  resendApiKey: _env.RESEND_API_KEY,
  mailFrom: _env.MAIL_FROM,
  audioLocalDir: _env.AUDIO_LOCAL_DIR,
  r2:
    _env.R2_ACCOUNT_ID &&
    _env.R2_ACCESS_KEY_ID &&
    _env.R2_SECRET_ACCESS_KEY &&
    _env.R2_BUCKET
      ? {
          accountId: _env.R2_ACCOUNT_ID,
          accessKeyId: _env.R2_ACCESS_KEY_ID,
          secretAccessKey: _env.R2_SECRET_ACCESS_KEY,
          bucket: _env.R2_BUCKET,
        }
      : undefined,
  audioCdn:
    _env.AUDIO_CDN_BASE && _env.AUDIO_PASS_SECRET
      ? { base: _env.AUDIO_CDN_BASE, secret: _env.AUDIO_PASS_SECRET }
      : undefined,
  isProduction: _env.NODE_ENV === "production",
} as const;
