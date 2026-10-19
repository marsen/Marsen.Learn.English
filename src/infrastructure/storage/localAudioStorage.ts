import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AudioStorage } from "@/application/examSet/ports";

/** 本機開發用：音檔存在指定資料夾（AUDIO_LOCAL_DIR）。 */
export class LocalAudioStorage implements AudioStorage {
  constructor(private readonly root: string) {}

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = resolve(this.root, key);
    // 防止 key 帶 ../ 跳出資料夾
    if (!path.startsWith(resolve(this.root)))
      throw new Error(`[storage] 不合法的 key：${key}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(join(path), bytes);
  }
}
