import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { AudioStorage } from "./ports";

/**
 * 取題組錄音。現在只開放審稿的老師聽（第 4 步考試時再開放給考生聽合格的題組）。
 */
export class GetExamSetAudio {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly storage: AudioStorage,
  ) {}

  async execute(input: { actor: Account; setId: string }): Promise<Uint8Array | null> {
    if (!can(input.actor.roles, "reviewSets")) return null;
    const set = await this.sets.findById(input.setId);
    if (!set) return null;
    return this.storage.get(set.audioKey);
  }
}
