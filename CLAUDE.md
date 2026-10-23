@AGENTS.md

# Marsen.Learn.English — 專案脈絡

雅思聽力練習網站：管理員上傳題組 → 老師審稿 → 學生（或路人）考試 → 自動批改 → 考試紀錄。
題組由姊妹專案 `Question.Generator` 產生（set.json + audio.mp3）。

## 架構（照 Becca.Surf.App）

Clean Architecture（Monolith，全在 Next.js 內）。依賴方向：

```
app（路由／Server Action，薄）→ presentation → application → domain ← infrastructure
```

- `src/domain`：純資料、規則、Repository port。**不能 import 任何外部套件**（lint 會擋）
- `src/application`：use case（一個類別一件事，constructor 注入 port，回傳 `{ ok, ... }`）
- `src/infrastructure`：env、DB（Neon + Drizzle）、auth（jose session）、寄信（Resend）、DI
- `src/presentation`：React 元件。可用 application 的結果型別；不 import app 或 infrastructure，Server Action 由頁面用 props 傳進來
- `src/app`：路由、Server Action、組裝各層

分層方向由 `eslint-plugin-boundaries` 強制（`eslint.config.mjs`），寫錯方向 `pnpm lint` 會失敗。

## 權限

- 角色：`admin`（管理員）、`teacher`（老師）、`student`（學生）；一個帳號可有多個角色，功能取聯集
- 路人（沒登入）不是角色，見 `GUEST_PERMISSIONS`
- 角色 → 功能對照表只在 `src/domain/account/permission.ts`，改權限只改這裡並更新測試
- 頁面用 `requirePermission(...)`（`infrastructure/auth/currentAccount.ts`）守門

## 開發規範

- **分支**：禁止直接 commit `main`，走 `feat|fix|docs|refactor|chore/<短名>`；Conventional Commits
- **main**：沒有 Marsen 同意，不得 commit、合併或推送到 `main`
- **驗收**：`pnpm lint` + `pnpm test` + `pnpm build` 都要過
- **環境變數**：集中 `src/infrastructure/config/env.ts`、Zod fail-fast、不在 code 寫預設值
- **migration**：自動部署會先跑 migration 再上線，所以 migration 要讓舊版程式還能用（刪欄位、改名分兩次上線，見 `docs/deploy-cloud-run.md`）
- **測試**：Vitest，測試檔跟原始碼放一起（`*.test.ts`），描述用中文；domain／application 必測
- **格式**：Prettier（`pnpm format`）
- **UI**：顏色、字型只用 `globals.css` 的 token（`primary`、`muted`…），不寫死顏色；目前是暫用樣式，之後會整體改
- 溝通語言：中文
- 回覆規則：
  - 直接給結果，不要前言、不要總結
  - 使用工具後，只回報結果，不描述過程
  - 除非使用者主動問，否則不解釋在做什麼
  - 程式碼和資料維持完整精確，只壓縮自然語言

## 本機開發

開發伺服器固定用 **3100** port（`pnpm dev`），避免跟其他專案（Arsenal、Becca 用 3000）撞在一起；`SITE_URL` 也設成 3100。

一定要有資料庫：`DATABASE_URL` 沒設定就啟動失敗（本機和正式環境都一樣，不再有記憶體資料模式）。
本機連開發用的資料庫（Neon 的 dev branch），不要連正式資料庫；第一次用 `pnpm db:migrate`、`pnpm db:seed` 建好資料表和 admin@marsen.me。
錄音沒設定 R2 時要設 `AUDIO_LOCAL_DIR`。沒設 `RESEND_API_KEY` 時登入碼直接顯示在登入頁。
記憶體版 repository（`infrastructure/persistence/inMemory*`）只給測試用。

## 舊版

改寫前的純 JS 版本（候補頁 /listening、/fluency、舊 /exam、review/、api/、意見回饋表單）已刪除，要參考時從 git 歷史拿：最後還在的 commit 是 `dad7a51`（`git show dad7a51:legacy/<路徑>`）。
