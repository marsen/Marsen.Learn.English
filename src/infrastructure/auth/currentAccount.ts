import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Account } from "@/domain/account/account";
import { can, type Permission } from "@/domain/account/permission";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { getAccountRepository } from "@/infrastructure/di/authContainer";

/** 由 session cookie 取得目前登入的帳號（沒登入或無效則 null）。 */
export async function getCurrentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return getAccountRepository().findById(payload.sub);
}

/** 頁面守衛：要登入。沒登入導去 /login。 */
export async function requireAccount(redirectBack = "/admin"): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) redirect(`/login?redirect=${encodeURIComponent(redirectBack)}`);
  return account;
}

/** 頁面守衛：要登入且有這個功能。沒有權限導回 /admin（後台首頁會列出能用的功能）。 */
export async function requirePermission(permission: Permission): Promise<Account> {
  const account = await requireAccount();
  if (!can(account.roles, permission)) redirect("/admin?denied=1");
  return account;
}
