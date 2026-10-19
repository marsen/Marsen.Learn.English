import type { AudioStorage } from "@/application/examSet/ports";

/** 記憶體版音檔儲存（測試用）。 */
export class InMemoryAudioStorage implements AudioStorage {
  readonly files = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.files.set(key, { bytes, contentType });
  }
}
