#!/usr/bin/env bash
# 設定 GitHub Actions 自動部署到 Cloud Run（只要做一次）。
# 用法：bash scripts/setup-github-deploy.sh [GCP 專案 id]
# - 建一個專門部署用的服務帳號 github-deployer，只給部署需要的權限
# - 用 Workload Identity Federation：GitHub 每次執行拿短效憑證，不用把金鑰放進 GitHub
# - 只有 marsen/Marsen.Learn.English 的 main 分支能拿到憑證
# - 有裝 gh 就順便設定 GitHub 的 repository variables；沒有就印出來讓你手動貼
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null)}"
REPO="marsen/Marsen.Learn.English"
POOL="github"
PROVIDER="github"
SA_NAME="github-deployer"

[ -n "$PROJECT" ] || { echo "請給 GCP 專案 id"; exit 1; }
NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
RUNTIME_SA="$NUM-compute@developer.gserviceaccount.com"
echo "專案：$PROJECT（$NUM）　GitHub：$REPO"

echo "1/5 啟用需要的服務"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT"

echo "2/5 建部署用的服務帳號"
gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
    --display-name "GitHub Actions deployer (learn-english)"

echo "3/5 給部署需要的權限"
for role in roles/run.sourceDeveloper roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
    --member "serviceAccount:$SA" --role "$role" >/dev/null
done
# 部署時要用執行服務的那個帳號（預設的 compute 帳號）
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --project "$PROJECT" --quiet \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser >/dev/null

echo "4/5 設定 Workload Identity Federation（只允許 $REPO 的 main）"
gcloud iam workload-identity-pools describe "$POOL" --location global --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location global --project "$PROJECT" \
    --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location global \
  --workload-identity-pool "$POOL" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location global \
    --workload-identity-pool "$POOL" --project "$PROJECT" \
    --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository=='$REPO' && assertion.ref=='refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" --quiet \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" >/dev/null

WIF="projects/$NUM/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"

echo "5/5 設定 GitHub 的 repository variables"
if command -v gh >/dev/null 2>&1; then
  gh variable set GCP_PROJECT --repo "$REPO" --body "$PROJECT"
  gh variable set GCP_DEPLOY_SA --repo "$REPO" --body "$SA"
  gh variable set GCP_WIF_PROVIDER --repo "$REPO" --body "$WIF"
  echo "完成。之後 main 的 CI 通過就會自動部署。"
else
  echo "沒有 gh 指令，請到 GitHub → $REPO → Settings → Secrets and variables → Actions → Variables 新增："
  echo "  GCP_PROJECT      = $PROJECT"
  echo "  GCP_DEPLOY_SA    = $SA"
  echo "  GCP_WIF_PROVIDER = $WIF"
fi
