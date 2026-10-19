import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 上傳題組時要帶錄音檔（一套約 3–4 MB），Server Action 預設上限只有 1 MB
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
