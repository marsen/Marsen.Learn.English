import { can } from "@/domain/account/permission";
import { canTake } from "@/domain/examSet/access";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { rolesOf, type Actor } from "@/application/shared/actor";
import type { AudioStorage } from "./ports";

/** 短效網址的有效時間：一場考試約 30–40 分鐘，給 1 小時 */
export const AUDIO_URL_TTL_SECONDS = 60 * 60;

/** 錄音怎麼給：轉到儲存空間的短效網址，或由網站自己送出 */
export type AudioSource =
  { kind: "url"; url: string } | { kind: "bytes"; bytes: Uint8Array };

/**
 * 取題組錄音：審稿的老師可以聽任何一套；考生只能聽自己能考的考卷。
 * 不能聽一律回 null（呼叫端回 404，不透露題組存不存在）。
 * 權限一定先在這裡檢查過，才會給短效網址。
 */
export class GetExamSetAudio {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly storage: AudioStorage,
  ) {}

  async execute(input: { actor: Actor; setId: string }): Promise<AudioSource | null> {
    const set = await this.sets.findById(input.setId);
    if (!set) return null;
    const roles = rolesOf(input.actor);
    if (!can(roles, "reviewSets") && !canTake(roles, set)) return null;

    const url = await this.storage.downloadUrl(set.audioKey, AUDIO_URL_TTL_SECONDS);
    if (url) return { kind: "url", url };
    const bytes = await this.storage.get(set.audioKey);
    return bytes ? { kind: "bytes", bytes } : null;
  }
}
