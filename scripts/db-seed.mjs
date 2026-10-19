// 帳號角色 seed（CLI；用 pnpm db:seed 執行，讀 .env.local 的 DATABASE_URL）
// 重跑不會重複建立（idempotent）。
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("[seed] DATABASE_URL is required（請設定 .env.local）");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const seeds = [{ email: "admin@marsen.me", roles: ["admin", "teacher"] }];

for (const s of seeds) {
  await sql`INSERT INTO accounts (email) VALUES (${s.email}) ON CONFLICT (email) DO NOTHING`;
  const [{ id }] = await sql`SELECT id FROM accounts WHERE email = ${s.email}`;
  for (const role of s.roles) {
    await sql`INSERT INTO account_roles (account_id, role) VALUES (${id}, ${role}) ON CONFLICT DO NOTHING`;
  }
  console.log(`✓ ${s.email} (${s.roles.join(", ")})`);
}
console.log("seed done");
