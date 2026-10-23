import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "./uploadExamSet";
import { ListExamSets } from "./listExamSets";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAudioStorage } from "@/infrastructure/storage/inMemoryAudioStorage";
import { NodeSha256 } from "@/infrastructure/crypto/nodeSha256";

const sha256 = new NodeSha256();
const fixture = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/set.sample.json", import.meta.url),
    "utf8",
  ),
);

/** 產生一份錄音與對應的 set.json（錄音雜湊、大小會對得上） */
function bundle(overrides: (b: typeof fixture) => void = () => {}) {
  const audio = new Uint8Array(20_000).map((_, i) => i % 251);
  const b = structuredClone(fixture);
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  overrides(b);
  return { setJsonText: JSON.stringify(b), audio };
}

const account = (roles: Role[]): Account => ({
  id: "00000000-0000-0000-0000-000000000001",
  email: "a@marsen.me",
  roles,
  createdAt: new Date(),
});
const admin = account(["admin"]);

let sets: InMemoryExamSetRepository;
let storage: InMemoryAudioStorage;
const upload = (actor: Account, input: ReturnType<typeof bundle>) =>
  new UploadExamSet(sets, storage, sha256).execute({ actor, ...input });

beforeEach(() => {
  sets = new InMemoryExamSetRepository();
  storage = new InMemoryAudioStorage();
});

describe("UploadExamSet", () => {
  it("應該讓管理員上傳 AI 有疑慮的題組，狀態是待老師審稿、先下架", async () => {
    const r = await upload(admin, bundle());
    expect(r).toEqual({
      ok: true,
      setId: "s1-sample-0001",
      title: fixture.title,
      aiVerdict: "needs_human",
    });
    const [saved] = await sets.list();
    expect(saved.status).toBe("pending_review");
    expect(saved.access).toBe("unlisted");
    expect(saved.uploadedBy).toBe(admin.id);
    expect(storage.files.has(saved.audioKey)).toBe(true);
  });

  it("應該把答案存在私密部分，公開部分不含答案與逐字稿", async () => {
    await upload(admin, bundle());
    const [saved] = await sets.list();
    const publicJson = JSON.stringify(saved);
    expect(publicJson).not.toContain(fixture.answers.answers[0].note);
    expect(saved.timing.events.every((e) => !("text" in e) && !("speaker" in e))).toBe(
      true,
    );
    expect(sets.privateOf("s1-sample-0001")?.answers).toEqual(fixture.answers);
  });

  it("應該擋下沒有上傳權限的帳號（只有老師、學生）", async () => {
    for (const roles of [["teacher"], ["student"], []] as Role[][]) {
      const r = await upload(account(roles), bundle());
      expect(r.ok).toBe(false);
    }
    expect(await sets.list()).toHaveLength(0);
  });

  it("應該擋下重複上傳同一套題", async () => {
    await upload(admin, bundle());
    const r = await upload(admin, bundle());
    expect(r.ok).toBe(false);
  });

  it("應該擋下錄音和 set.json 對不上的情況，而且不存任何東西", async () => {
    const input = bundle();
    const r = await upload(admin, { ...input, audio: input.audio.map((x) => x ^ 1) });
    expect(r.ok).toBe(false);
    expect(storage.files.size).toBe(0);
    expect(await sets.list()).toHaveLength(0);
  });

  it("應該擋下壞掉的 JSON 與缺欄位的 set.json", async () => {
    expect((await upload(admin, { ...bundle(), setJsonText: "{oops" })).ok).toBe(false);
    const r = await upload(
      admin,
      bundle((b) => delete b.paper),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toContain("paper");
  });

  it("應該擋下沒有 AI 審稿結論的舊格式（只有 provenance.review）", async () => {
    const r = await upload(
      admin,
      bundle((b) => {
        delete b.provenance.ai_review;
        b.provenance.review = { ok: true };
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("應該擋下答案規則不認得的答案卡（上傳後會批改不了）", async () => {
    const r = await upload(
      admin,
      bundle((b) => {
        b.answers.answers[0].answer_policy = "fuzzy";
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toContain("answer_policy");
  });
});

describe("UploadExamSet 逐字稿（set.json 2.1）", () => {
  /** 照時間軸產生逐字稿，每題的出處依序指到一句 */
  const withTranscript = (b: typeof fixture) => {
    const turnIds: string[] = b.timing.events
      .filter((e: { type: string }) => e.type === "turn")
      .map((e: { id: string }) => e.id);
    b.schema_minor = 1;
    b.transcript = {
      turns: turnIds.map((id) => ({ id, speaker: "A", text: `secret line ${id}` })),
      evidence: b.answers.answers.map((a: { question_id: string }, i: number) => ({
        question_id: a.question_id,
        turn: turnIds[i * 2],
        quote: `secret line ${turnIds[i * 2]}`,
      })),
    };
  };

  it("應該把逐字稿存在私密部分，公開部分看不到", async () => {
    const r = await upload(admin, bundle(withTranscript));
    expect(r.ok).toBe(true);
    const [saved] = await sets.list();
    expect(JSON.stringify(saved)).not.toContain("secret line");
    const t = sets.privateOf("s1-sample-0001")?.transcript;
    expect(t?.turns[0]).toEqual({ id: "t1", speaker: "A", text: "secret line t1" });
    expect(t?.evidence[0]).toEqual({
      questionId: "q01",
      turn: "t1",
      quote: "secret line t1",
    });
  });

  it("應該照常收下沒有逐字稿的 2.0 題組，逐字稿是 null", async () => {
    expect((await upload(admin, bundle())).ok).toBe(true);
    expect(sets.privateOf("s1-sample-0001")?.transcript).toBeNull();
  });

  it("應該擋下跟時間軸對不上的逐字稿", async () => {
    const r = await upload(
      admin,
      bundle((b) => {
        withTranscript(b);
        b.transcript.turns.pop();
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join()).toContain("時間軸");
    expect(await sets.list()).toHaveLength(0);
  });

  it("應該擋下大版號不是 2 的題組，小版號不影響", async () => {
    expect(
      (
        await upload(
          admin,
          bundle((b) => (b.schema_version = 3)),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await upload(
          admin,
          bundle((b) => (b.schema_minor = 7)),
        )
      ).ok,
    ).toBe(true);
  });
});

describe("ListExamSets", () => {
  it("應該讓管理員與老師看清單，學生看不到", async () => {
    await upload(admin, bundle());
    const list = new ListExamSets(sets);
    expect(await list.execute({ actor: admin })).toHaveLength(1);
    expect(await list.execute({ actor: account(["teacher"]) })).toHaveLength(1);
    expect(await list.execute({ actor: account(["student"]) })).toBeNull();
  });
});
