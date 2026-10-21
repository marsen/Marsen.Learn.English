import type { Role } from "./role";

/**
 * 功能（權限）。角色之間沒有上下級，每個角色各自勾選能用的功能。
 */
export const PERMISSIONS = [
  "uploadSets", // 上傳題目
  "reviewSets", // 審稿（評估試卷是否合格）
  "setExamAccess", // 設定考卷開放對象（公開／會員）
  "takeExam", // 寫考卷（能寫哪幾張另看考卷的開放對象，見 examSet/access.ts）
  "viewResult", // 看批改結果（分數與每題對錯）
  "viewAnswerKey", // 看正解（路人要註冊才看得到）
  "keepRecords", // 考試紀錄
  "manageRoles", // 管理權限
  "viewReviewLog", // 看審稿紀錄（每位老師審了幾套，算老師費用用）
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** 角色 → 功能 對照表（2026-10-19 與 Marsen 確認；2026-10-20 加上設定考卷開放對象） */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  admin: ["uploadSets", "setExamAccess", "manageRoles", "viewReviewLog"],
  teacher: ["reviewSets", "takeExam", "viewResult", "viewAnswerKey", "keepRecords"],
  student: ["takeExam", "viewResult", "viewAnswerKey", "keepRecords"],
};

/** 路人（沒登入）能用的功能 */
export const GUEST_PERMISSIONS: readonly Permission[] = ["takeExam", "viewResult"];

/**
 * 一個帳號能用的功能 = 它所有角色的功能加起來。
 * 沒有任何角色的帳號，等同路人。
 */
export function permissionsOf(roles: readonly Role[]): Set<Permission> {
  if (roles.length === 0) return new Set(GUEST_PERMISSIONS);
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]));
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return permissionsOf(roles).has(permission);
}
