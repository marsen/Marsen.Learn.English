import { can } from "@/domain/account/permission";
import { canTake } from "@/domain/examSet/access";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { rolesOf, type Actor } from "@/application/shared/actor";
import type { AudioStorage } from "./ports";

/**
 * 取題組錄音：審稿的老師可以聽任何一套；考生只能聽自己能考的考卷。
 * 不能聽一律回 null（呼叫端回 404，不透露題組存不存在）。
 */
export class GetExamSetAudio {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly storage: AudioStorage,
  ) {}

  async execute(input: { actor: Actor; setId: string }): Promise<Uint8Array | null> {
    const set = await this.sets.findById(input.setId);
    if (!set) return null;
    const roles = rolesOf(input.actor);
    if (!can(roles, "reviewSets") && !canTake(roles, set)) return null;
    return this.storage.get(set.audioKey);
  }
}
