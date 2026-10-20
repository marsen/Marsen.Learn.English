"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeEmail } from "@/domain/auth/email";
import type {
  LoginFormState,
  VerifyFormState,
} from "@/presentation/components/formStates";
import { SESSION_COOKIE, createSessionToken } from "@/infrastructure/auth/session";
import {
  devLoginLinkFor,
  requestLoginLink,
  verifyLoginLink,
} from "@/infrastructure/di/authContainer";
import { env } from "@/infrastructure/config/env";
import { readGuestId } from "@/infrastructure/auth/guestKey";
import { claimGuestAttempts } from "@/infrastructure/di/examSetContainer";
import { getAccountRepository } from "@/infrastructure/di/authContainer";
import { can } from "@/domain/account/permission";

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function requestLoginLinkAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const result = await requestLoginLink().execute({ email });
  if (!result.ok) return { error: result.error };
  return { sent: true, devLink: devLoginLinkFor(normalizeEmail(email)) ?? undefined };
}

export async function verifyLoginLinkAction(
  _prev: VerifyFormState,
  formData: FormData,
): Promise<VerifyFormState> {
  const token = String(formData.get("token") ?? "");
  const result = await verifyLoginLink().execute({ token });
  if (!result.ok) return { error: result.error };

  const session = await createSessionToken(result.accountId);
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS,
  });

  // 路人註冊／登入：把這個瀏覽器先前寫的考卷移到帳號名下，直接帶去看最近一次的完整結果（含正解）
  const claimed = await claimGuestAttempts().execute({
    accountId: result.accountId,
    guestId: await readGuestId(),
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
