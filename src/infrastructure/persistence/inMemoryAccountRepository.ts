import { randomUUID } from "node:crypto";
import type { Account } from "@/domain/account/account";
import type { AccountRepository } from "@/domain/account/accountRepository";
import type { Role } from "@/domain/account/role";

/** 記憶體版帳號 repository（測試、沒有資料庫的本機開發）。 */
export class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly accounts: Account[] = []) {}

  async findById(id: string): Promise<Account | null> {
    return this.copy(this.accounts.find((a) => a.id === id));
  }

  async findByEmail(email: string): Promise<Account | null> {
    return this.copy(this.accounts.find((a) => a.email === email));
  }

  async create(email: string): Promise<Account> {
    const account: Account = {
      id: randomUUID(),
      email,
      roles: [],
      createdAt: new Date(),
    };
    this.accounts.push(account);
    return { ...account, roles: [] };
  }

  async addRole(accountId: string, role: Role): Promise<void> {
    const account = this.accounts.find((a) => a.id === accountId);
    if (account && !account.roles.includes(role)) account.roles.push(role);
  }

  private copy(account: Account | undefined): Account | null {
    return account ? { ...account, roles: [...account.roles] } : null;
  }
}
