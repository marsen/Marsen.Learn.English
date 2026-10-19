import { pgTable, uuid, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

/** 帳號。以 email 識別（存正規化後的小寫）。 */
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 帳號角色：一個帳號可以有多筆（例如 管理員＋老師）。 */
export const accountRoles = pgTable(
  "account_roles",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'admin' | 'teacher' | 'student'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.role] })],
);

/** 一次性登入碼。只存雜湊；用過就標 used_at。 */
export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
