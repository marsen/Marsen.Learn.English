# 部署到 Cloud Run

網站跑在 Google Cloud Run（台灣機房 asia-east1）；資料在 Neon、錄音在 R2（經 audio-gate 送出）、寄信用 Resend，容器本身不存檔案。

## 環境變數放哪

| 變數 | 唯一源頭 | 怎麼到 Cloud Run |
|---|---|---|
| `DATABASE_URL`（正式資料庫） | GitHub Secret（repo → Settings → Secrets and variables → Actions） | 每次自動部署同步；只改 Secret 時，到 Actions 手動按 Deploy 的 Run workflow |
| 其他（`AUTH_SECRET`、`AUTH_TOKEN_TTL`、`RESEND_API_KEY`、`MAIL_FROM`、`R2_*`、`AUDIO_CDN_BASE`、`AUDIO_PASS_SECRET`、`SITE_URL`） | Cloud Run 服務設定 | 用 `gcloud run services update` 直接改（見下面） |

- 本機 `.env.local` 連的是開發用資料庫（Neon dev branch），**不放正式資料庫的連線字串**
- 改其他變數：
  ```
  gcloud run services update learn-english --region asia-east1 \
    --update-env-vars RESEND_API_KEY=re_xxx
  ```

## 每次更新

推上 main、CI 通過後，GitHub Actions 自動執行（`.github/workflows/deploy.yml`）：

1. 檢查 GitHub Secret `DATABASE_URL` 有設定
2. `pnpm db:migrate`（正式資料庫）；失敗就停在這裡，不部署
3. 部署到 Cloud Run，同時把 `DATABASE_URL` 同步到服務上

也可以在 GitHub 的 Actions → Deploy 手動按 Run workflow。

### migration 的規則

migration 跑完到新版上線之間，舊版程式還在服務；新版部署失敗時，舊版也會繼續跑。所以 migration 要讓舊版程式還能用：

- 加欄位、加資料表：一次上線
- 刪欄位、改名：分兩次。第一次上線先讓程式不再用它，第二次再刪掉

## 第一次建立服務（服務已經存在就不用做）

自動部署只會更新既有的服務。服務不見了、或要搬到新專案時，先手動建一次：

```
gcloud run deploy learn-english --source . --region asia-east1 \
  --allow-unauthenticated --memory 512Mi --cpu 1 \
  --min-instances 0 --max-instances 3 --timeout 60
```

- 第一次會問要不要啟用 Cloud Run、Cloud Build、Artifact Registry，回答 y
- 建好後用上面「改其他變數」的方式補上環境變數，再到 GitHub 跑一次 Deploy（同步 `DATABASE_URL`）

## 設定自動部署（只要做一次）

`bash scripts/setup-github-deploy.sh`

- 建部署專用的服務帳號 `github-deployer`，只給部署需要的權限
- 用 Workload Identity Federation：GitHub 不存任何 GCP 金鑰，而且只有這個 repo 的 main 能部署
- 有裝 `gh` 會自動設定 GitHub 的 repository variables（`GCP_PROJECT`、`GCP_DEPLOY_SA`、`GCP_WIF_PROVIDER`）
- 自動部署只會同步 `DATABASE_URL`；其他環境變數用 `gcloud run services update` 改

## 接上自己的網域（例如 learn.marsen.me）

1. 驗證網域擁有權（一次）：`gcloud domains verify marsen.me`，照網頁指示在 Cloudflare 加 TXT 記錄
2. `bash scripts/setup-custom-domain.sh map learn.marsen.me`，把印出來的記錄加到 Cloudflare DNS（DNS only，灰色雲）
3. 等 https://learn.marsen.me 打得開（憑證 15 分鐘到 1 小時）
4. `bash scripts/setup-custom-domain.sh switch learn.marsen.me`（登入信改用這個網址）

## 設定

- 沒人用時自動關機（不收費），第一個人進來要等幾秒（冷啟動）
- 最多開 3 台，避免被灌爆時費用失控
- 環境變數存在 Cloud Run 服務設定裡（`DATABASE_URL` 由 GitHub Secret 同步）
