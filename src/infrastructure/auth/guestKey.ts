import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/infrastructure/config/env";

/**
 * 路人的瀏覽器識別：一個只存在這個瀏覽器的隨機值（httpOnly cookie）。
 * 資料庫只存它的雜湊（guestId），路人的作答只有這個瀏覽器看得到，登入後移到帳號名下。
 */
const GUEST_COOKIE = "guest_key";
const NINETY_DAYS = 60 * 60 * 24 * 90;

const toGuestId = (key: string) =>
  createHash("sha256").update(`guest:${key}`).digest("hex");

/** 讀取目前瀏覽器的 guestId；沒有就回 null（頁面、Route Handler 用） */
export async function readGuestId(): Promise<string | null> {
  const key = (await cookies()).get(GUEST_COOKIE)?.value;
  return key ? toGuestId(key) : null;
}

/** 取得 guestId，沒有就建立 cookie（只能在 Server Action 裡用） */
export async function ensureGuestId(): Promise<string> {
  const store = await cookies();
  let key = store.get(GUEST_COOKIE)?.value;
  if (!key) {
    key = randomBytes(32).toString("base64url");
    store.set(GUEST_COOKIE, key, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: NINETY_DAYS,
    });
  }
  return toGuestId(key);
}
