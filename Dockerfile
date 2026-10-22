# 網站的映像檔（部署到 Cloud Run）。錄音在 R2、資料在 Neon，容器本身不存任何檔案。
# 建置：gcloud run deploy --source .（Cloud Build 會用這個檔案）

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

# 1. 安裝套件
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. 建置（環境變數在執行時才給；這裡只放讓建置通過的佔位值，不會進到正式環境）
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=http://build.invalid \
    AUTH_SECRET=build-only-placeholder \
    AUTH_TOKEN_TTL=7d
RUN pnpm exec next build

# 3. 執行：只帶 standalone 伺服器和靜態檔
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 8080
CMD ["node", "server.js"]
