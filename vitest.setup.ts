/**
 * 測試環境變數：在測試檔載入前設好，讓 infrastructure/config/env.ts 的 Zod 驗證通過。
 * 單元測試自己組記憶體 repository，不連資料庫；DATABASE_URL 只是讓驗證通過的佔位值，不會真的連線。
 */
process.env.SITE_URL ??= "http://localhost:3100";
process.env.AUTH_SECRET ??= "test-secret-please-ignore";
process.env.AUTH_TOKEN_TTL ??= "7d";
process.env.DATABASE_URL ??= "postgresql://test:test@db.invalid/test";
