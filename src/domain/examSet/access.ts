import { can } from "@/domain/account/permission";
import type { Role } from "@/domain/account/role";
import type { ExamSet } from "./examSet";

/**
 * 誰能寫哪一張考卷（做法 2：一個「寫考卷」權限＋考卷自己的開放對象）：
 * - 只有合格（approved）的考卷能考
 * - 要有「寫考卷」權限（只有管理員角色的帳號沒有）
 * - 開放對象是 public：路人也能寫；members：要是有角色的會員；unlisted（下架）：誰都不能寫
 * 沒登入、或登入但沒有任何角色，都算路人（roles 為空）。
 */
export function canTake(
  roles: readonly Role[],
  set: Pick<ExamSet, "status" | "access">,
): boolean {
  if (set.status !== "approved") return false;
  if (!can(roles, "takeExam")) return false;
  if (set.access === "unlisted") return false;
  return set.access === "public" || roles.length > 0;
}
