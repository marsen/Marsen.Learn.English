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
  readFileSync(new URL("./fixtures/set.needs-human.json", import.meta.url), "utf8"),
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
  it("應該讓管理員上傳 AI 有疑慮的題組，狀態是待老師審稿", async () => {
    const r = await upload(admin, bundle());
    expect(r).toEqual({
      ok: true,
      setId: "s1-gym-0001",
      title: fixture.title,
      aiVerdict: "needs_human",
    });
    const [saved] = await sets.list();
    expect(saved.status).toBe("pending_review");
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
    expect(sets.privateOf("s1-gym-0001")?.answers).toEqual(fixture.answers);
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

describe("ListExamSets", () => {
  it("應該讓管理員與老師看清單，學生看不到", async () => {
    await upload(admin, bundle());
    const list = new ListExamSets(sets);
    expect(await list.execute({ actor: admin })).toHaveLength(1);
    expect(await list.execute({ actor: account(["teacher"]) })).toHaveLength(1);
    expect(await list.execute({ actor: account(["student"]) })).toBeNull();
  });
});
