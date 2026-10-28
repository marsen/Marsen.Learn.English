import type { Account } from "@/domain/account/account";
import { can } from "@/domain/account/permission";
import {
  audioKeyFor,
  bundleProblems,
  isAiVerdict,
  toPublicTiming,
  transcriptProblems,
} from "@/domain/examSet/bundle";
import type { ExamSet, ExamSetPrivate, Transcript } from "@/domain/examSet/examSet";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import type { Sha256 } from "@/application/shared/ports";
import type { AudioStorage } from "./ports";
import { setJsonSchema } from "./setJsonSchema";
import { parseAnswerKey } from "./answerKey";
import type { UploadExamSetResult, UploadProblem } from "./examSetResult";

/**
 * 管理員上傳一套題組（set.json + 錄音）。
 * - 只有「上傳題目」權限的帳號能用
 * - AI 審稿有疑慮（needs_human）的照樣收下，狀態是「待老師審稿」
 * - 同一個 set_id 已經有了：沒說要覆蓋就回報「已存在」（不寫入）；說要覆蓋就當成新上傳
 *   整套換掉、待審、下架，目前的審稿意見清掉（審稿紀錄保留）；已交卷的作答紀錄不受影響
 * - 逐字稿（2.1 起的 transcript）只存在私密部分，考生拿不到
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
    /** 同一個 set_id 已經有了時，確定要覆蓋 */
    overwrite?: boolean;
  }): Promise<UploadExamSetResult> {
    if (!can(input.actor.roles, "uploadSets")) {
      return { ok: false, problems: [{ code: "forbidden" }] };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(input.setJsonText);
    } catch {
      return { ok: false, problems: [{ code: "invalidJson" }] };
    }
    const parsed = setJsonSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        problems: parsed.error.issues.map((i) => ({
          code: "schemaField" as const,
          path: i.path.join("."),
          message: i.message,
        })),
      };
    }
    const b = parsed.data;

    const sha = this.sha256.hex(input.audio);
    const aiVerdict = b.provenance.ai_review?.verdict;
    const problems: UploadProblem[] = bundleProblems({
      schemaVersion: b.schema_version,
      declaredAudio: { bytes: b.audio.bytes, sha256: b.audio.sha256 },
      actualAudio: { bytes: input.audio.byteLength, sha256: sha },
      validateOk: b.provenance.validate?.ok === true,
      aiVerdict,
    });
    // 答案卡要能拿來批改（例如答案規則必須是認得的），不然上傳後考生交卷會批改不了
    const key = parseAnswerKey(b.answers);
    if (!key.ok) problems.push(...key.problems);
    // 逐字稿（2.1 起）：可有可無；有的話要跟時間軸、答案卡對得上
    const transcript: Transcript | null = b.transcript
      ? {
          turns: b.transcript.turns.map((t) => ({
            id: t.id,
            speaker: t.speaker,
            text: t.text,
          })),
          evidence: b.transcript.evidence.map((e) => ({
            questionId: e.question_id,
            turn: e.turn,
            quote: e.quote,
          })),
        }
      : null;
    if (transcript && key.ok) {
      const timingTurnIds = b.timing.events
        .filter((e) => e.type === "turn" && typeof e.id === "string")
        .map((e) => e.id as string);
      problems.push(
        ...transcriptProblems(
          transcript,
          timingTurnIds,
          key.entries.map((e) => e.questionId),
        ),
      );
    }
    if (problems.length > 0 || !isAiVerdict(aiVerdict)) return { ok: false, problems };

    const audioKey = audioKeyFor(b.set_id, sha);
    const next: ExamSet = {
      setId: b.set_id,
      title: b.title,
      topic: b.topic,
      questionCount: b.question_count,
      paper: b.paper,
      timing: toPublicTiming(b.timing),
      audioKey,
      aiVerdict,
      schemaMinor: b.schema_minor ?? 0,
      status: "pending_review",
      access: "unlisted", // 新上傳先下架，老師通過後由管理員上架
      uploadedBy: input.actor.id,
      uploadedAt: this.now(),
    };
    const nextSecret: ExamSetPrivate = {
      setId: b.set_id,
      answers: b.answers,
      provenance: b.provenance,
      transcript,
    };
    const done = { ok: true as const, setId: b.set_id, title: b.title, aiVerdict };

    const current = await this.sets.findById(b.set_id);
    if (!current) {
      await this.storage.put(audioKey, input.audio, "audio/mpeg");
      await this.sets.save(next, nextSecret);
      return { ...done, outcome: "created" };
    }
    if (!input.overwrite) {
      return { ok: false, problems: [], existing: { setId: b.set_id, title: current.title } };
    }
    // 覆蓋＝當成新上傳：待審、下架。錄音換了就另存新檔（舊檔留著，正在考的人不會被抽掉）
    if (audioKey !== current.audioKey) {
      await this.storage.put(audioKey, input.audio, "audio/mpeg");
    }
    await this.sets.replace(next, nextSecret);
    return { ...done, outcome: "replaced" };
  }
}
