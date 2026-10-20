import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";

/** 目前操作的人：登入的帳號，或 null（路人） */
export type Actor = Account | null;

/** 路人當作沒有角色 */
export function rolesOf(actor: Actor): Role[] {
  return actor?.roles ?? [];
}

/**
 * 作答的主人：登入的帳號，或路人（用瀏覽器識別 guestId）。
 * guestId 是 infrastructure 從 cookie 算出來的雜湊；登入的人不用它。
 */
export type ExamTaker = { actor: Actor; guestId: string | null };

export function ownerOf(who: ExamTaker): {
  accountId: string | null;
  guestId: string | null;
} {
  return who.actor
    ? { accountId: who.actor.id, guestId: null }
    : { accountId: null, guestId: who.guestId };
}
