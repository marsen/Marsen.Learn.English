import type { Account } from "./account";
import type { Role } from "./role";

/** 帳號儲存的 port（實作在 infrastructure/persistence）。 */
export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  /** email 須已正規化（小寫、去空白） */
  findByEmail(email: string): Promise<Account | null>;
  create(email: string): Promise<Account>;
  /** 重複加同一個角色不會出錯 */
  addRole(accountId: string, role: Role): Promise<void>;
  /** 用新的角色清單整個取代 */
  setRoles(accountId: string, roles: Role[]): Promise<void>;
  /** 依 email 排序 */
  list(): Promise<Account[]>;
}
