# audio-gate

在 Cloudflare 各地節點送出考試錄音的小程式（Cloudflare Workers）。

- 網站發「通行證」（錄音網址後面的 `exp`、`sig`），這支程式檢查通過才給錄音
- 錄音先從當地節點的快取拿，沒有才去 R2 拿；R2 bucket 不對外公開
- 簽名格式要跟網站的 `src/infrastructure/storage/audioPass.ts` 一致

## 第一次設定

1. **R2 bucket**：照網站的步驟建好（名稱寫在 `wrangler.toml` 的 `bucket_name`）
2. **部署**：在專案根目錄執行 `pnpm audio-gate:deploy`
   - 第一次會打開瀏覽器請你登入 Cloudflare
   - 會自動產生密鑰、部署、設定密鑰，並把 `AUDIO_CDN_BASE`、`AUDIO_PASS_SECRET` 加進 `.env.local`
   - `audio.marsen.me` 會自動接到這支程式（`marsen.me` 的 DNS 要在同一個 Cloudflare 帳號）
3. 重開 `pnpm dev`
4. **流量限制**：Cloudflare 後台 → marsen.me → Security → WAF → Rate limiting rules，
   新增一條：Hostname 等於 `audio.marsen.me`，同一個 IP 超過一定次數就擋（免費方案只能建一條，可選的時間區間以後台為準）

## 費用

- Workers 免費方案每天 10 萬次請求；超過當天會回錯誤，不會收錢
- 快取命中不會讀 R2；R2 下載流量不收費
