import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/infrastructure/auth/session";

/**
 * 後台路由守衛：沒有有效 session 一律導去 /login。只作用於 /admin/*。
 * 這裡只檢查「有沒有登入」；「有沒有權限」由各頁的 requirePermission 檢查。
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
