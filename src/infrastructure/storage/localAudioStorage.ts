import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AudioStorage } from "@/application/examSet/ports";

/** 本機開發用：音檔存在指定資料夾（AUDIO_LOCAL_DIR）。 */
export class LocalAudioStorage implements AudioStorage {
  constructor(private readonly root: string) {}

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathOf(key)));
    } catch {
      return null;
    }
  }

  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    // 防止 key 帶 ../ 跳出資料夾
    if (!path.startsWith(resolve(this.root)))
      throw new Error(`[storage] 不合法的 key：${key}`);
    return path;
  }
}
