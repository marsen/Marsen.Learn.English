# M5 試用版：本機測試與 Vercel 部署

故事：同學開網址 → 免登入作答 → 做完留信箱 → 收到結果連結 → 點連結（同時驗證信箱與登入）看分數與每題對錯 → 可以做下一套、給回饋。

## 本機測試（不需要 Supabase 與 Vercel）

```
npm install
npm run dev        # 開 http://127.0.0.1:5173/exam/
```

- 本機用開發假後端（`scripts/dev-api.mjs`，跑的是和正式環境同一份 `api/_core.mjs`）：資料存在記憶體，重開就清空。
- 做完一套會停在「留信箱」；輸入任一信箱後，頁面會多一個「直接開結果連結」（只有本機看得到），代替真的收信。
- 題組清單來自 `scripts/dev-sets.json`（4 套）。有錄音的只有 `s1-gym-0002`（錄音檔在本機 `content/sets/s1-gym-0002/audio/`，不進 git）。
- 自動測試：`npm test`（含登入、批改、留信箱、結果連結、權限規則）。

## Vercel + Supabase（要你做的設定）

1. **Supabase 建專案**。SQL Editor 執行 `supabase/schema.sql`。
2. **Storage**：新增私有（private）桶 `recordings`。
3. **Authentication**
   - Sign In / Providers → Email 開啟，**開放註冊（Allow new users to sign up）保持開啟**（同學第一次寄結果連結時自動建立帳號）。
   - URL Configuration → Site URL 與 Redirect URLs 加上你的網站網址（Vercel 網址，也可加自己的網域），例如 `https://xxx.vercel.app/**`。
   - Email Templates → Magic Link：把標題與內文改成「你的聽力測驗結果連結」之類，不然同學收到的是英文的 Magic Link。
   - **SMTP**：內建寄信額度很低（每小時只有幾封），給同學用之前要接自己的寄信服務（Resend、SendGrid 等）。沒接的話，第三、四位同學就收不到信。
4. **Vercel 專案**連到 GitHub repo（目前還沒有 remote），環境變數設四個（Production 與 Preview 都要）：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（管理金鑰，只放這裡，不進 git、不貼對話）
   - `SITE_URL`（例如 `https://xxx.vercel.app`，結果連結導回的網站；沒設就用請求的網域）
5. 編輯 `exam/config.js`：填 `supabaseUrl`、`supabaseAnonKey`（公開金鑰，可以進 git）、`contactEmail`。
6. 發佈題組到 Supabase（環境變數 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 在你的終端機設定）：
   先在 Question.Generator 跑 `node src/cli.mjs bundle sets/s1-gym-0002 --out out`，再 `node scripts/publish.mjs ../Question.Generator/out/s1-gym-0002`（未審核題組預設擋住；自己測試時才加 `--allow-unreviewed`，這個決定是你的）。
7. 部署後的檢查清單（規格 6.7）：免登入開得到題組清單 → 做完看到「留信箱」而不是分數 → 收到信、點連結看到分數 → 用另一個信箱開同一個結果連結看不到（404）→ 公開網址抓不到 `content/`、`plan.json`。

## 已知限制

- 免登入也就沒有擋「亂開作答」：任何人能建立 attempt（只佔一列資料）。同學小規模試用沒問題；公開給更多人前要加防濫用。
- 留信箱限制：同一次作答最多寄 3 封結果連結。
- 一個瀏覽器同時只記住一份「還沒領結果」的作答；沒領就開始下一套，前一套的結果就領不到了（結果仍在資料庫，但沒有連結可進入）。
- 錄音的字母拼讀（人名）仍不穩定，見 `docs/voice-cast-plan.md`；先走通整個故事，錄音之後再處理。
