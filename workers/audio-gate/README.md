# audio-gate

在 Cloudflare 各地節點送出考試錄音的小程式（Cloudflare Workers）。

- 網站發「通行證」（錄音網址後面的 `exp`、`sig`），這支程式檢查通過才給錄音
- 錄音先從當地節點的快取拿，沒有才去 R2 拿；R2 bucket 不對外公開
- 簽名格式要跟網站的 `src/infrastructure/storage/audioPass.ts` 一致

## 第一次設定

1. **R2 bucket**：照網站的步驟建好（名稱寫在 `wrangler.toml` 的 `bucket_name`）
2. **產生密鑰**（網站和這支程式共用一把）：
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
3. **部署**（在這個資料夾）：
   ```
   npx wrangler@4 login
   npx wrangler@4 secret put AUDIO_PASS_SECRET   # 貼上第 2 步的密鑰
   npx wrangler@4 deploy
   ```
   會自動把 `audio.marsen.me` 接到這支程式（`marsen.me` 的 DNS 要在 Cloudflare 上）
4. **網站 `.env.local`** 加上：
   ```
   AUDIO_CDN_BASE=https://audio.marsen.me
   AUDIO_PASS_SECRET=第 2 步的密鑰
   ```
5. **流量限制**：Cloudflare 後台 → marsen.me → Security → WAF → Rate limiting rules，
   新增一條：Hostname 等於 `audio.marsen.me`，同一個 IP 超過一定次數就擋（免費方案只能建一條，可選的時間區間以後台為準）

## 費用

- Workers 免費方案每天 10 萬次請求；超過當天會回錯誤，不會收錢
- 快取命中不會讀 R2；R2 下載流量不收費
