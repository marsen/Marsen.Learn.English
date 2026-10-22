import { can } from "@/domain/account/permission";
import { canTake } from "@/domain/examSet/access";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { rolesOf, type Actor } from "@/application/shared/actor";
import type { AudioStorage, RateLimiter } from "./ports";

/**
 * 錄音網址的有效時間：10 分鐘。
 * 播放器拿到網址後馬上開始下載；中途過期或斷線，播放器會回網站拿新的（自動重試）。
 */
export const AUDIO_URL_TTL_SECONDS = 10 * 60;

/** 同一個人 10 分鐘內最多拿幾次錄音網址（防止拿網址去狂刷儲存空間） */
export const AUDIO_URL_LIMIT = 20;
export const AUDIO_URL_WINDOW_MS = 10 * 60_000;

/** 錄音怎麼給：轉到儲存空間的網址、由網站自己送出，或拿太多次被擋 */
export type AudioSource =
  | { kind: "url"; url: string }
  | { kind: "bytes"; bytes: Uint8Array }
  | { kind: "limited" };

/**
 * 取題組錄音：審稿的老師可以聽任何一套；考生只能聽自己能考的考卷。
 * 不能聽一律回 null（呼叫端回 404，不透露題組存不存在）。
 * 權限一定先在這裡檢查過，才會給網址；給網址還要過次數限制。
 */
export class GetExamSetAudio {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly storage: AudioStorage,
    private readonly limiter: RateLimiter,
  ) {}

  async execute(input: {
    actor: Actor;
    setId: string;
    /** 用來算次數的身分：帳號、路人的瀏覽器識別或 IP 雜湊；都沒有就算同一個「不知名」 */
    requester: string | null;
  }): Promise<AudioSource | null> {
    const set = await this.sets.findById(input.setId);
    if (!set) return null;
    const roles = rolesOf(input.actor);
    if (!can(roles, "reviewSets") && !canTake(roles, set)) return null;

    const url = await this.storage.downloadUrl(set.audioKey, AUDIO_URL_TTL_SECONDS);
    if (url) {
      const ok = await this.limiter.hit(
        `audio:${input.requester ?? "anonymous"}`,
        AUDIO_URL_LIMIT,
        AUDIO_URL_WINDOW_MS,
      );
      return ok ? { kind: "url", url } : { kind: "limited" };
    }
    const bytes = await this.storage.get(set.audioKey);
    return bytes ? { kind: "bytes", bytes } : null;
  }
}
