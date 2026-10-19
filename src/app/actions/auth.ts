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
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
