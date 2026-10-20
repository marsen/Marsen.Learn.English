import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * 申請者 IP 的雜湊（只用來限制寄送次數，不存原 IP）。
 * 部署在 Vercel 等代理後面時，真正的 IP 在 x-forwarded-for 的第一個；取不到回 null。
 */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip ? createHash("sha256").update(`ip:${ip}`).digest("hex") : null;
}
