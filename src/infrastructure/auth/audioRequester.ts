import type { Actor } from "@/application/shared/actor";
import { clientIpHash } from "./clientIp";
import { readGuestId } from "./guestKey";

/** 拿錄音網址的人是誰（算次數用）：帳號 → 路人的瀏覽器識別 → IP 雜湊 */
export async function audioRequester(actor: Actor): Promise<string | null> {
  if (actor) return `account:${actor.id}`;
  const guest = await readGuestId();
  if (guest) return `guest:${guest}`;
  const ip = await clientIpHash();
  return ip ? `ip:${ip}` : null;
}
