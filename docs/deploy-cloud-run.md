# 部署到 Cloud Run

網站跑在 Google Cloud Run（台灣機房 asia-east1）；資料在 Neon、錄音在 R2（經 audio-gate 送出）、寄信用 Resend，容器本身不存檔案。

## 第一次

1. 安裝 gcloud CLI，登入並選專案：
   ```
   gcloud auth login
   gcloud config set project <專案 id>
   ```
2. 確認 `.env.local` 有正式環境要的變數：`DATABASE_URL`、`AUTH_SECRET`、`AUTH_TOKEN_TTL`、
   `RESEND_API_KEY`、`MAIL_FROM`、`R2_*` 四個（`AUDIO_CDN_BASE`、`AUDIO_PASS_SECRET` 有就會一起帶上去）
3. 資料庫是最新的：`pnpm db:migrate`
4. 部署：`pnpm deploy:cloud-run`
   - 第一次會問要不要啟用 Cloud Run、Cloud Build、Artifact Registry，回答 y
   - 沒給網址時，先用 Cloud Run 給的 `https://learn-english-xxxx.asia-east1.run.app`

## 之後每次更新

- **自動**：推上 main、CI 通過後，GitHub Actions 自動部署（`.github/workflows/deploy.yml`）
- **手動**：`pnpm deploy:cloud-run`（沿用目前的網址和設定；`.env.local` 改過的變數會一起更新上去）

## 設定自動部署（只要做一次）

`bash scripts/setup-github-deploy.sh`

- 建部署專用的服務帳號 `github-deployer`，只給部署需要的權限
- 用 Workload Identity Federation：GitHub 不存任何 GCP 金鑰，而且只有這個 repo 的 main 能部署
- 有裝 `gh` 會自動設定 GitHub 的 repository variables（`GCP_PROJECT`、`GCP_DEPLOY_SA`、`GCP_WIF_PROVIDER`）
- 自動部署不會改環境變數；改了 `.env.local` 的機密要上線，執行一次手動部署

## 接上自己的網域（例如 learn.marsen.me）

1. 驗證網域擁有權（一次）：`gcloud domains verify marsen.me`，照網頁指示在 Cloudflare 加 TXT 記錄
2. `bash scripts/setup-custom-domain.sh map learn.marsen.me`，把印出來的記錄加到 Cloudflare DNS（DNS only，灰色雲）
3. 等 https://learn.marsen.me 打得開（憑證 15 分鐘到 1 小時）
4. `bash scripts/setup-custom-domain.sh switch learn.marsen.me`（登入信改用這個網址）

## 設定

- 沒人用時自動關機（不收費），第一個人進來要等幾秒（冷啟動）
- 最多開 3 台，避免被灌爆時費用失控
- 環境變數存在 Cloud Run 服務設定裡；之後可以改用 Secret Manager
