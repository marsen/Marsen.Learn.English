import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import {
  audioKeyFor,
  bundleProblems,
  isAiVerdict,
  toPublicTiming,
} from "@/domain/examSet/bundle";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { Sha256 } from "@/application/shared/ports";
import type { AudioStorage } from "./ports";
import { setJsonSchema } from "./setJsonSchema";
import type { UploadExamSetResult } from "./examSetResult";

/**
 * 管理員上傳一套題組（set.json + 錄音）。
 * - 只有「上傳題目」權限的帳號能用
 * - AI 審稿有疑慮（needs_human）的照樣收下，狀態是「待老師審稿」
 * - 同一個 set_id 不能重複上傳
 * 寫入順序：先存錄音、再存資料；資料存失敗時錄音只是多一個沒人用的檔案，不會出現「有題目沒錄音」。
 */
export class UploadExamSet {
  constructor(
    private readonly sets: ExamSetRepository,
    private readonly storage: AudioStorage,
    private readonly sha256: Sha256,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: {
    actor: Account;
    setJsonText: string;
    audio: Uint8Array;
  }): Promise<UploadExamSetResult> {
    if (!can(input.actor.roles, "uploadSets")) {
      return { ok: false, problems: ["你的帳號沒有上傳題目的權限"] };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(input.setJsonText);
    } catch {
      return { ok: false, problems: ["set.json 不是有效的 JSON"] };
    }
    const parsed = setJsonSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        problems: parsed.error.issues.map(
          (i) => `set.json 欄位 ${i.path.join(".")}：${i.message}`,
        ),
      };
    }
    const b = parsed.data;

    const sha = this.sha256.hex(input.audio);
    const aiVerdict = b.provenance.ai_review?.verdict;
    const problems = bundleProblems({
      schemaVersion: b.schema_version,
      declaredAudio: { bytes: b.audio.bytes, sha256: b.audio.sha256 },
      actualAudio: { bytes: input.audio.byteLength, sha256: sha },
      validateOk: b.provenance.validate?.ok === true,
      aiVerdict,
    });
    if (problems.length > 0 || !isAiVerdict(aiVerdict)) return { ok: false, problems };

    if (await this.sets.exists(b.set_id)) {
      return { ok: false, problems: [`題組 ${b.set_id} 已經上傳過了`] };
    }

    const audioKey = audioKeyFor(b.set_id, sha);
    await this.storage.put(audioKey, input.audio, "audio/mpeg");
    await this.sets.save(
      {
        setId: b.set_id,
        title: b.title,
        topic: b.topic,
        questionCount: b.question_count,
        paper: b.paper,
        timing: toPublicTiming(b.timing),
        audioKey,
        aiVerdict,
        status: "pending_review",
        uploadedBy: input.actor.id,
        uploadedAt: this.now(),
      },
      { setId: b.set_id, answers: b.answers, provenance: b.provenance },
    );
    return { ok: true, setId: b.set_id, title: b.title, aiVerdict };
  }
}
