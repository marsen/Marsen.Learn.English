import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "./uploadExamSet";
import { GetExamSetForReview } from "./getExamSetForReview";
import { ReviewExamSet } from "./reviewExamSet";
import { GetExamSetAudio } from "./getExamSetAudio";
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
    expect(r.view.warnings[0]).toMatchObject({ questionId: "q07", aiRuling: "problem" });
    expect(r.view.findings.length).toBeGreaterThan(0);
    expect(r.view.findings[0]).toMatchObject({
      questionId: "q07",
      category: "ambiguity",
      severity: "warn",
    });
    expect(r.view.findings[0].suggestion).toContain("early morning");
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
  it("應該讓老師判合格，並記下整體意見、錄音建議與小題建議", async () => {
    const r = await review(teacher, {
      comment: " 整體不錯 ",
      audioNote: "[01:23] 這句太快",
      questionNotes: [
        { questionId: "q07", note: "early morning 也該算對" },
        { questionId: "q01", note: "   " },
      ],
    });
    expect(r).toEqual({ ok: true });
    expect((await sets.findById(SET))?.status).toBe("approved");
    expect(await sets.findReview(SET)).toMatchObject({
      reviewerId: "teacher",
      decision: "approved",
      comment: "整體不錯",
      audioNote: "[01:23] 這句太快",
      questionNotes: [{ questionId: "q07", note: "early morning 也該算對" }],
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

  it("應該擋下沒選判定、或對不存在小題的建議", async () => {
    expect((await review(teacher, { decision: undefined })).ok).toBe(false);
    const r = await review(teacher, {
      questionNotes: [{ questionId: "q99", note: "x" }],
    });
    expect(r.ok).toBe(false);
    expect((await sets.findById(SET))?.status).toBe("pending_review");
  });
});

describe("GetExamSetAudio", () => {
  it("應該只讓老師聽錄音", async () => {
    const get = new GetExamSetAudio(sets, storage);
    expect(await get.execute({ actor: teacher, setId: SET })).toEqual({
      kind: "bytes",
      bytes: audio,
    });
    expect(await get.execute({ actor: admin, setId: SET })).toBeNull();
    expect(await get.execute({ actor: student, setId: SET })).toBeNull();
  });

  it("應該在儲存空間支援時給短效網址，而且權限照樣先檢查", async () => {
    storage.urlBase = "https://r2.example";
    const get = new GetExamSetAudio(sets, storage);
    const r = await get.execute({ actor: teacher, setId: SET });
    expect(r?.kind).toBe("url");
    expect(r?.kind === "url" && r.url).toMatch(/^https:\/\/r2\.example\/.+\?ttl=3600$/);
    expect(await get.execute({ actor: student, setId: SET })).toBeNull();
  });
});
