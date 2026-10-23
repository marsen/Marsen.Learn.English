"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeEmail } from "@/domain/auth/email";
import type {
  LoginFormState,
  VerifyCodeFormState,
} from "@/presentation/components/formStates";
import { SESSION_COOKIE, createSessionToken } from "@/infrastructure/auth/session";
import {
  devLoginCodeFor,
  requestLoginCode,
  verifyLoginCode,
} from "@/infrastructure/di/authContainer";
import { env } from "@/infrastructure/config/env";
import { readGuestId } from "@/infrastructure/auth/guestKey";
import { clientIpHash } from "@/infrastructure/auth/clientIp";
import { claimGuestAttempts } from "@/infrastructure/di/examSetContainer";
import { getAccountRepository } from "@/infrastructure/di/authContainer";
import { can } from "@/domain/account/permission";

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function requestLoginCodeAction(
  prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const result = await requestLoginCode().execute({
    email,
    // 記下申請的瀏覽器：登入後把路人作答移到帳號名下
    guestId: await readGuestId(),
    ipHash: await clientIpHash(),
  });
  // 重寄失敗時留在輸入登入碼的步驟（上一組碼可能還能用）
  if (!result.ok)
    return { error: result.error, email, sentTo: prev.sentTo, sentAt: prev.sentAt };
  return {
    sentTo: email,
    sentAt: Date.now(),
    devCode: devLoginCodeFor(email) ?? undefined,
  };
}

export async function verifyLoginCodeAction(
  _prev: VerifyCodeFormState,
  formData: FormData,
): Promise<VerifyCodeFormState> {
  const result = await verifyLoginCode().execute({
    email: String(formData.get("email") ?? ""),
    code: String(formData.get("code") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const session = await createSessionToken(result.accountId);
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS,
  });

  // 路人註冊／登入：把路人作答移到帳號名下，直接帶去看最近一次的完整結果（含正解）。
  // 兩個來源都認領：申請登入碼時的瀏覽器，以及現在輸入登入碼的這個瀏覽器（通常是同一個）。
  const claimed = await claimGuestAttempts().execute({
    accountId: result.accountId,
    guestIds: [result.guestId, await readGuestId()],
  });
  if (claimed.length > 0) redirect(`/exam/result/${claimed[0]}`);

  const account = await getAccountRepository().findById(result.accountId);
  const backOffice =
    account &&
    (can(account.roles, "uploadSets") ||
      can(account.roles, "reviewSets") ||
      can(account.roles, "manageRoles"));
  redirect(backOffice ? "/admin" : "/exam");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
