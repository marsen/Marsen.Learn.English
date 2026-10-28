import type { Role } from "./role";
import { isRole } from "./role";

/**
 * 指定角色的規則：
 * - 角色只能是認得的（admin／teacher／student），重複的去掉
 * - 管理員不能拿掉自己的管理員角色（避免把自己鎖在外面，也保證至少留一個管理員）
 */
/** 違反規則的原因（代碼；文字在翻譯檔 errors.manage.*） */
export type RoleProblem =
  { code: "unknownRoles"; roles: string[] } | { code: "cannotRemoveOwnAdmin" };

export function roleProblems(input: {
  actorId: string;
  targetId: string;
  roles: readonly string[];
}): RoleProblem[] {
  const problems: RoleProblem[] = [];
  const unknown = input.roles.filter((r) => !isRole(r));
  if (unknown.length > 0) problems.push({ code: "unknownRoles", roles: unknown });
  if (input.actorId === input.targetId && !input.roles.includes("admin")) {
    problems.push({ code: "cannotRemoveOwnAdmin" });
  }
  return problems;
}

export function cleanRoles(roles: readonly string[]): Role[] {
  return [...new Set(roles.filter(isRole))];
}
