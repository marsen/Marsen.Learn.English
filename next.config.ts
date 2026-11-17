import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 多語系：每個請求用哪種語言、載入哪份翻譯，設定在這個檔案
const withNextIntl = createNextIntlPlugin("./src/infrastructure/i18n/request.ts");

/**
 * 上傳請求的大小上限，同時管兩層（兩層要一樣，只改一層照樣會失敗）：
 * 1. Server Action 本身（Next 預設 1 MB）
 * 2. 請求會先經過 src/proxy.ts，proxy 也有自己的上限（Next 預設 10 MB，超過的部分被截掉，上傳會失敗）
 * 為什麼是 20 MB：上傳題組要帶錄音檔，一套約 3–4 MB，四個 section 的完整考卷約 13 MB，留一些餘裕。
 */
const UPLOAD_BODY_LIMIT = "20mb";

const nextConfig: NextConfig = {
  // 部署到 Cloud Run：打包成只含必要檔案的獨立伺服器（.next/standalone）
  output: "standalone",
  experimental: {
    // 上傳上限：兩層都用 UPLOAD_BODY_LIMIT（說明見上面）
    serverActions: { bodySizeLimit: UPLOAD_BODY_LIMIT },
    proxyClientMaxBodySize: UPLOAD_BODY_LIMIT,
  },
};

export default withNextIntl(nextConfig);
