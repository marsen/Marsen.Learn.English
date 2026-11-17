import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 多語系：每個請求用哪種語言、載入哪份翻譯，設定在這個檔案
const withNextIntl = createNextIntlPlugin("./src/infrastructure/i18n/request.ts");

const nextConfig: NextConfig = {
  // 部署到 Cloud Run：打包成只含必要檔案的獨立伺服器（.next/standalone）
  output: "standalone",
  experimental: {
    // 上傳題組時要帶錄音檔（一套約 3–4 MB，完整考卷約 13 MB）。請求大小有兩層上限，要一起改：
    // 1. Server Action 本身（預設 1 MB）
    // 2. 請求會先經過 src/proxy.ts，proxy 也有自己的上限（預設 10 MB，超過的部分被截掉，上傳會失敗）
    serverActions: { bodySizeLimit: "20mb" },
    proxyClientMaxBodySize: "20mb",
  },
};

export default withNextIntl(nextConfig);
