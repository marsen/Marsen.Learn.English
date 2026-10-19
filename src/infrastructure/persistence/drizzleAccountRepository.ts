import { eq } from "drizzle-orm";
import type { Account } from "@/domain/account/account";
import type { AccountRepository } from "@/domain/account/accountRepository";
import { isRole, type Role } from "@/domain/account/role";
import { createDb, type Db } from "@/infrastructure/db/client";
import { accountRoles, accounts } from "@/infrastructure/db/schema";

type Row = typeof accounts.$inferSelect;

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: Db = createDb()) {}

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);
    return row ? this.withRoles(row) : null;
  }

  async findByEmail(email: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return row ? this.withRoles(row) : null;
  }

  async create(email: string): Promise<Account> {
    const [row] = await this.db.insert(accounts).values({ email }).returning();
    return { id: row.id, email: row.email, roles: [], createdAt: row.createdAt };
  }

  async addRole(accountId: string, role: Role): Promise<void> {
    await this.db.insert(accountRoles).values({ accountId, role }).onConflictDoNothing();
  }

  private async withRoles(row: Row): Promise<Account> {
    const roles = await this.db
      .select({ role: accountRoles.role })
      .from(accountRoles)
      .where(eq(accountRoles.accountId, row.id));
    return {
      id: row.id,
      email: row.email,
      // 資料庫裡若出現未知角色字串，直接忽略（不給任何權限）
      roles: roles.map((r) => r.role).filter(isRole),
      createdAt: row.createdAt,
    };
  }
}
