/**
 * 角色（純資料）。一個帳號可以同時有多個角色。
 * 路人（沒登入的人）不是角色，見 permission.ts 的 GUEST_PERMISSIONS。
 */
export const ROLES = ["admin", "teacher", "student"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
