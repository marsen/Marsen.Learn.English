import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";

/** 目前操作的人：登入的帳號，或 null（路人） */
export type Actor = Account | null;

/** 路人當作沒有角色 */
export function rolesOf(actor: Actor): Role[] {
  return actor?.roles ?? [];
}
