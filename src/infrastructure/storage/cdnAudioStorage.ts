import type { AudioStorage } from "@/application/examSet/ports";
import { audioPassExpiry, signAudioPass } from "./audioPass";

/**
 * 錄音經過 Cloudflare 各地節點（audio-gate Workers）送給學生。
 * 存放、讀取、刪除照舊交給裡面的儲存（R2）；只有「給瀏覽器的網址」改成帶通行證的 CDN 網址。
 */
export class CdnAudioStorage implements AudioStorage {
  constructor(
    private readonly inner: AudioStorage,
    private readonly cdnBase: string,
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    return this.inner.put(key, bytes, contentType);
  }

  get(key: string): Promise<Uint8Array | null> {
    return this.inner.get(key);
  }

  delete(key: string): Promise<void> {
    return this.inner.delete(key);
  }

  /** 通行證一天內不變（瀏覽器可以快取）；ttlSeconds 不用，到期由 audioPassExpiry 決定 */
  async downloadUrl(key: string): Promise<string> {
    const exp = audioPassExpiry(this.now());
    const path = key.split("/").map(encodeURIComponent).join("/");
    const url = new URL(`${this.cdnBase.replace(/\/$/, "")}/${path}`);
    url.searchParams.set("exp", String(exp));
    url.searchParams.set("sig", signAudioPass(key, exp, this.secret));
    return url.toString();
  }
}
