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

`pnpm deploy:cloud-run`（會沿用目前的網址）

## 換成自己的網域（例如 learn.marsen.me）

接好網域後：`pnpm deploy:cloud-run https://learn.marsen.me`（登入信的連結會用這個網址）

## 設定

- 沒人用時自動關機（不收費），第一個人進來要等幾秒（冷啟動）
- 最多開 3 台，避免被灌爆時費用失控
- 環境變數存在 Cloud Run 服務設定裡；之後可以改用 Secret Manager
