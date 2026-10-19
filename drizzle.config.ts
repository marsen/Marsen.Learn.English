import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// CLI 工具：不走 Next.js module graph，直接讀 .env.local（憲章 VI 的腳本例外）
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("[drizzle] DATABASE_URL is required（請設定 .env.local）");
  process.exit(1);
}

export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
