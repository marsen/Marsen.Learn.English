import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/infrastructure/config/env";
import * as schema from "./schema";

/**
 * 建立 Drizzle DB client（Neon HTTP driver）。
 * 只在有 DATABASE_URL 時呼叫（由 composition root 判斷）。
 */
export function createDb() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(env.databaseUrl);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
