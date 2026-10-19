import type { AudioStorage } from "@/application/examSet/ports";

/** 記憶體版音檔儲存（測試、沒有設定儲存空間的本機開發）。 */
export class InMemoryAudioStorage implements AudioStorage {
  readonly files = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.files.set(key, { bytes, contentType });
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.files.get(key)?.bytes ?? null;
  }
}
