import { SignJWT, jwtVerify } from "jose";
import { env } from "@/infrastructure/config/env";

/**
 * 登入 session：jose 簽發／驗證的 JWT（HS256），存在 httpOnly cookie。
 * subject 是帳號 id。Edge runtime（proxy）也能用。
 */
const secret = new TextEncoder().encode(env.authSecret);

export const SESSION_COOKIE = "session";

export type SessionPayload = { sub: string };

export async function createSessionToken(accountId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(env.authTokenTtl)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
