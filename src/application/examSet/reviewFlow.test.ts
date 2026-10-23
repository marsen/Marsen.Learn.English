import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "./uploadExamSet";
import { GetExamSetForReview } from "./getExamSetForReview";
import { ReviewExamSet, parseReviewPayload } from "./reviewExamSet";
import { GetExamSetAudio } from "./getExamSetAudio";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAudioStorage } from "@/infrastructure/storage/inMemoryAudioStorage";
import { InMemoryRateLimiter } from "@/infrastructure/limits/inMemoryRateLimiter";
import { NodeSha256 } from "@/infrastructure/crypto/nodeSha256";

const sha256 = new NodeSha256();
const fixture = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/set.sample.json", import.meta.url),
    "utf8",
  ),
);
const SET = "s1-sample-0001";

const account = (id: string, roles: Role[]): Account => ({
  id,
  email: `${id}@marsen.me`,
  roles,
  createdAt: new Date(),
});
const admin = account("admin", ["admin"]);
const teacher = account("teacher", ["teacher"]);
const student = account("student", ["student"]);

let sets: InMemoryExamSetRepository;
let storage: InMemoryAudioStorage;
let audio: Uint8Array;

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  storage = new InMemoryAudioStorage();
  audio = new Uint8Array(20_000).map((_, i) => i % 251);
  const b = structuredClone(fixture);
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  await new UploadExamSet(sets, storage, sha256).execute({
    actor: admin,
    setJsonText: JSON.stringify(b),
    audio,
  });
});

const review = (
  actor: Account,
  input: Partial<Parameters<ReviewExamSet["execute"]>[0]>,
) =>
  new ReviewExamSet(sets).execute({ actor, setId: SET, decision: "approved", ...input });

describe("GetExamSetForReview", () => {
  it("應該給老師看到每一題的標準答案、題目位置與 AI 示警", async () => {
    const r = await new GetExamSetForReview(sets).execute({ actor: teacher, setId: SET });
    if (!r.ok) throw new Error(r.reason);
    expect(r.view.questions).toHaveLength(10);
    expect(r.view.questions[0]).toMatchObject({
      questionId: "q01",
      label: "Address",
      section: "Personal details",
      answer: "37",
      trap: "self_correction",
      wrongValue: "47",
    });
    expect(r.view.questions[0].number).toBe(1);
    expect(r.view.paper.sections.length).toBeGreaterThan(0);
    const warning = r.view.aiNotes.find((n) => n.kind === "warning");
    expect(warning).toMatchObject({ questionId: "q07", aiRuling: "problem" });
    expect(warning?.ref).toMatch(/^warning:/);
    const finding = r.view.aiNotes.find((n) => n.kind === "finding");
    expect(finding).toMatchObject({
      ref: "finding:0",
      questionId: "q07",
      category: "ambiguity",
      severity: "warn",
    });
    expect(finding?.suggestion).toContain("early morning");
    // 2.0 的題組沒有逐字稿
    expect(r.view.turns).toBeNull();
    expect(r.view.questions[0].evidence).toBeNull();
    expect(r.view.review).toBeNull();
  });

  it("應該不給沒有審稿權限的人看答案（管理員、學生）", async () => {
    for (const actor of [admin, student]) {
      const r = await new GetExamSetForReview(sets).execute({ actor, setId: SET });
      expect(r).toEqual({ ok: false, reason: "forbidden" });
    }
  });

  it("應該對不存在的題組回 not_found", async () => {
    const r = await new GetExamSetForReview(sets).execute({
      actor: teacher,
      setId: "nope",
    });
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("ReviewExamSet", () => {
  it("應該讓老師判合格，並記下整體意見、每題與整套的意見、對 AI 意見的處理", async () => {
    const r = await review(teacher, {
      comment: " 整體不錯 ",
      notes: [
        { target: null, text: "[01:23] 這句太快" },
        { target: "q07", text: "early morning 也該算對" },
        { target: "q01", text: "   " },
      ],
      aiActions: [
        { ref: "finding:0", action: "edited", text: " 同意，改逐字稿 " },
        { ref: "finding:0", action: "deleted", text: "不用改" },
      ],
    });
    expect(r).toEqual({ ok: true });
    expect((await sets.findById(SET))?.status).toBe("approved");
    expect(await sets.findReview(SET)).toMatchObject({
      reviewerId: "teacher",
      decision: "approved",
      comment: "整體不錯",
      notes: [
        { target: null, text: "[01:23] 這句太快" },
        { target: "q07", text: "early morning 也該算對" },
      ],
      aiActions: [{ ref: "finding:0", action: "deleted", text: "不用改" }],
    });
  });

  it("應該可以改判，以最後一次為準", async () => {
    await review(teacher, { decision: "approved" });
    await review(teacher, { decision: "rejected", comment: "答案卡太窄" });
    expect((await sets.findById(SET))?.status).toBe("rejected");
    expect((await sets.findReview(SET))?.comment).toBe("答案卡太窄");
  });

  it("應該擋下沒有審稿權限的人（管理員、學生）", async () => {
    for (const actor of [admin, student]) {
      expect((await review(actor, {})).ok).toBe(false);
    }
    expect((await sets.findById(SET))?.status).toBe("pending_review");
  });

  it("應該擋下沒選判定、對不存在小題的意見、不存在的 AI 意見", async () => {
    expect((await review(teacher, { decision: undefined })).ok).toBe(false);
    expect((await review(teacher, { notes: [{ target: "q99", text: "x" }] })).ok).toBe(
      false,
    );
    const r = await review(teacher, {
      aiActions: [{ ref: "finding:99", action: "deleted", text: null }],
    });
    expect(r).toEqual({ ok: false, problems: [{ code: "unknownAiNote" }] });
    expect((await sets.findById(SET))?.status).toBe("pending_review");
  });
});

describe("parseReviewPayload", () => {
  it("應該讀出審稿頁送來的意見，格式不對回傳 null", () => {
    const ok = { notes: [{ target: null, text: "a" }], aiActions: [] };
    expect(parseReviewPayload(JSON.stringify(ok))).toEqual(ok);
    expect(parseReviewPayload("{oops")).toBeNull();
    expect(parseReviewPayload(null)).toBeNull();
    expect(
      parseReviewPayload(
        JSON.stringify({ notes: [], aiActions: [{ ref: "x", action: "kept" }] }),
      ),
    ).toBeNull();
  });
});

describe("GetExamSetAudio", () => {
  it("應該只讓老師聽錄音", async () => {
    const get = new GetExamSetAudio(sets, storage, new InMemoryRateLimiter());
    expect(await get.execute({ actor: teacher, setId: SET, requester: null })).toEqual({
      kind: "bytes",
      bytes: audio,
    });
    expect(await get.execute({ actor: admin, setId: SET, requester: null })).toBeNull();
    expect(await get.execute({ actor: student, setId: SET, requester: null })).toBeNull();
  });

  it("應該限制同一個人拿網址的次數（超過回 limited）", async () => {
    storage.urlBase = "https://r2.example";
    const get = new GetExamSetAudio(sets, storage, new InMemoryRateLimiter());
    const ask = (requester: string) =>
      get.execute({ actor: teacher, setId: SET, requester });
    for (let i = 0; i < 20; i += 1) expect((await ask("t1"))?.kind).toBe("url");
    expect(await ask("t1")).toEqual({ kind: "limited" });
    expect((await ask("t2"))?.kind).toBe("url");
  });

  it("應該在儲存空間支援時給短效網址，而且權限照樣先檢查", async () => {
    storage.urlBase = "https://r2.example";
    const get = new GetExamSetAudio(sets, storage, new InMemoryRateLimiter());
    const r = await get.execute({ actor: teacher, setId: SET, requester: null });
    expect(r?.kind).toBe("url");
    expect(r?.kind === "url" && r.url).toMatch(/^https:\/\/r2\.example\/.+\?ttl=600$/);
    expect(await get.execute({ actor: student, setId: SET, requester: null })).toBeNull();
  });
});
