# Marsen.Learn.English

雅思聽力練習網站（Next.js + TypeScript，架構同 Becca.Surf.App）。規範見 `CLAUDE.md`。

## 本機跑起來

```bash
pnpm install
cp .env.example .env.local   # 填 AUTH_SECRET（說明在檔案裡）
pnpm dev                     # http://localhost:3100/login
```

用 `admin@marsen.me` 登入：按「寄登入連結給我」→ 頁面會出現「直接開登入連結」（開發模式不真的寄信）→ 按「完成登入」。

```bash
pnpm test     # 單元測試
pnpm lint     # 含分層規則檢查
pnpm build
```

## 接上 Neon 與 Resend（上線前）

1. Neon 建專案，把連線網址填進 `.env.local` 的 `DATABASE_URL`
2. `pnpm db:migrate` 建表，`pnpm db:seed` 建立 admin@marsen.me（管理員＋老師）
3. Resend 驗證 `marsen.me` 網域，填 `RESEND_API_KEY` 與 `MAIL_FROM`
4. Vercel 環境變數設同樣幾個（加上正式的 `SITE_URL`）

## 舊版

改寫前的頁面在 `legacy/`，說明見 `legacy/README.md`。
