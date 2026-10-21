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
- **驗收**：`pnpm lint` + `pnpm test` + `pnpm build` 都要過
- **環境變數**：集中 `src/infrastructure/config/env.ts`、Zod fail-fast、不在 code 寫預設值
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

開發伺服器固定用 **3100** port（`pnpm dev`），避免跟其他專案（Arsenal、Becca 用 3000）撞在一起；`SITE_URL` 也要是 3100，登入連結才會連回這裡。

不用任何金鑰：沒設 `DATABASE_URL` 用記憶體資料（自動建好 admin@marsen.me 管理員＋老師），
沒設 `RESEND_API_KEY` 時登入連結直接顯示在登入頁。

## 舊版

`legacy/` 是改寫前的純 JS 版本（候補頁、/exam/、review/、api/），逐步搬進來後刪除。
`pnpm test:legacy` 跑舊版測試（要先在 `legacy/` 跑一次 `npm install`）。
