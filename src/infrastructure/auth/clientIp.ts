import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * 從 x-forwarded-for 取出真正的使用者 IP。
 *
 * 使用者可以自己在請求裡帶 x-forwarded-for（例如「1.2.3.4」），Cloud Run 前面的 Google 代理
 * 會把它看到的真正 IP 接在最後面，網站收到的是「1.2.3.4, <真正的 IP>」。
 * 所以要取最後一個：前面的都可能是使用者自己填的。
 *
 * 前面多加一層代理時（例如 Cloudflare 改成橘色雲朵、加 Google 負載平衡器），最後一個會變成代理的 IP，
 * 要改成往前數，否則所有人會被當成同一個 IP。
 */
export function clientIpFrom(forwardedFor: string | null): string | null {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.at(-1) ?? null;
}

/** 申請者 IP 的雜湊（用來限制寄送次數、錄音通行證，不存原 IP）；取不到回 null。 */
export async function clientIpHash(): Promise<string | null> {
  const ip = clientIpFrom((await headers()).get("x-forwarded-for"));
  return ip ? createHash("sha256").update(`ip:${ip}`).digest("hex") : null;
}
