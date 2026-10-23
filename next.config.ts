import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 多語系：每個請求用哪種語言、載入哪份翻譯，設定在這個檔案
const withNextIntl = createNextIntlPlugin("./src/infrastructure/i18n/request.ts");

const nextConfig: NextConfig = {
  // 部署到 Cloud Run：打包成只含必要檔案的獨立伺服器（.next/standalone）
  output: "standalone",
  experimental: {
    // 上傳題組時要帶錄音檔（一套約 3–4 MB），Server Action 預設上限只有 1 MB
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default withNextIntl(nextConfig);
