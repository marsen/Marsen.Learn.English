#!/usr/bin/env bash
# 把自己的網域接到 Cloud Run（例如 learn.marsen.me）。分兩步：
#   bash scripts/setup-custom-domain.sh map    [網域]   建立網域對應，印出要加到 Cloudflare 的 DNS 記錄
#   bash scripts/setup-custom-domain.sh switch [網域]   憑證好了以後，把登入信的網址（SITE_URL）換成這個網域
set -euo pipefail

STEP="${1:-}"
DOMAIN="${2:-learn.marsen.me}"
ROOT="${DOMAIN#*.}"
SERVICE="learn-english"
REGION="asia-east1"
PROJECT="$(gcloud config get-value project 2>/dev/null)"

case "${STEP}" in
  map)
    if ! gcloud domains list-user-verified --format='value(id)' | grep -qx "${ROOT}"; then
      echo "${ROOT} 還沒在 Google 驗證過擁有權。執行下面這行，照開出來的網頁在 Cloudflare 加一筆 TXT 記錄："
      echo "  gcloud domains verify ${ROOT}"
      echo "驗證完再執行一次這個指令。"
      exit 1
    fi
    gcloud beta run domain-mappings describe --domain "${DOMAIN}" --region "${REGION}" --project "${PROJECT}" >/dev/null 2>&1 ||
      gcloud beta run domain-mappings create --service "${SERVICE}" --domain "${DOMAIN}" \
        --region "${REGION}" --project "${PROJECT}"
    echo
    echo "到 Cloudflare → ${ROOT} → DNS 新增下面的記錄，Proxy status 要選「DNS only」（灰色雲）："
    gcloud beta run domain-mappings describe --domain "${DOMAIN}" --region "${REGION}" --project "${PROJECT}" \
      --format='table(status.resourceRecords[].type,status.resourceRecords[].name,status.resourceRecords[].rrdata)'
    echo
    echo "Google 會自動申請 HTTPS 憑證，通常 15 分鐘到 1 小時。https://${DOMAIN} 打得開以後，執行："
    echo "  bash scripts/setup-custom-domain.sh switch ${DOMAIN}"
    ;;
  switch)
    gcloud run services update "${SERVICE}" --region "${REGION}" --project "${PROJECT}" \
      --update-env-vars "SITE_URL=https://${DOMAIN}"
    echo "完成：登入信的連結會用 https://${DOMAIN}"
    ;;
  *)
    echo "用法：bash scripts/setup-custom-domain.sh map|switch [網域]"
    exit 1
    ;;
esac
