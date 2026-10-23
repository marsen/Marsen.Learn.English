import type { AudioStorage } from "@/application/examSet/ports";

/** 記憶體版音檔儲存（只給測試用；網站本身用 R2 或本機資料夾）。 */
export class InMemoryAudioStorage implements AudioStorage {
  readonly files = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.files.set(key, { bytes, contentType });
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.files.get(key)?.bytes ?? null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  /** 測試用：設定後 downloadUrl 會回假的短效網址（模擬 R2） */
  urlBase: string | null = null;

  async downloadUrl(key: string, ttlSeconds: number): Promise<string | null> {
    return this.urlBase ? `${this.urlBase}/${key}?ttl=${ttlSeconds}` : null;
  }
}
