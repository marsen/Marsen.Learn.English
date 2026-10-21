/**
 * 測試環境變數：在測試檔載入前設好，讓 infrastructure/config/env.ts 的 Zod 驗證通過。
 * 刻意不設 DATABASE_URL、RESEND_API_KEY，讓單元測試走記憶體 repository 與開發用寄信。
 */
process.env.SITE_URL ??= "http://localhost:3100";
process.env.AUTH_SECRET ??= "test-secret-please-ignore";
process.env.AUTH_TOKEN_TTL ??= "7d";
