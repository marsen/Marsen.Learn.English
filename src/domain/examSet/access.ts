import { can } from "@/domain/account/permission";
import type { Role } from "@/domain/account/role";
import type { ExamSet } from "./examSet";

/**
 * 誰能寫哪一張考卷（做法 2：一個「寫考卷」權限＋考卷自己的開放對象）：
 * - 要有「寫考卷」權限（只有管理員角色的帳號沒有）
 * - public（全站唯一、首頁試考用）：誰都能寫，不看審稿狀態（管理員說了算）
 * - members：要是有角色的會員，且考卷要合格（approved）
 * - unlisted（下架）：誰都不能寫
 * 沒登入、或登入但沒有任何角色，都算路人（roles 為空）。
 */
export function canTake(
  roles: readonly Role[],
  set: Pick<ExamSet, "status" | "access">,
): boolean {
  if (!can(roles, "takeExam")) return false;
  if (set.access === "unlisted") return false;
  if (set.access === "public") return true;
  return set.status === "approved" && roles.length > 0;
}
