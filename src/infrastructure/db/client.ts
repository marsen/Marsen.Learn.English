import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/infrastructure/config/env";
import * as schema from "./schema";

/** 建立 Drizzle DB client（Neon HTTP driver）。 */
export function createDb() {
  const sql = neon(env.databaseUrl);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
