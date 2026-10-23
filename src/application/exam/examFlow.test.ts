import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { SetExamAccess } from "@/application/examSet/setExamAccess";
import { GetExamSetAudio } from "@/application/examSet/getExamSetAudio";
import { ListAvailableExams } from "./listAvailableExams";
import { StartExam } from "./startExam";
import { SubmitExam } from "./submitExam";
import { GetAttemptResult } from "./getAttemptResult";
import { ClaimGuestAttempts } from "./claimGuestAttempts";
import { ListMyAttempts } from "./listMyAttempts";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAttemptRepository } from "@/infrastructure/persistence/inMemoryAttemptRepository";
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

const account = (id: string, roles: Role[]): Account => ({
  id,
  email: `${id}@marsen.me`,
  roles,
  createdAt: new Date(),
});
const admin = account("admin", ["admin"]);
const teacher = account("teacher", ["teacher"]);
const student = account("student", ["student"]);
const student2 = account("student2", ["student"]);
const guest = null;

let sets: InMemoryExamSetRepository;
let attempts: InMemoryAttemptRepository;
let storage: InMemoryAudioStorage;

/** 上傳一套題；decision 有給就審稿 */
async function addSet(setId: string, decision?: "approved" | "rejected") {
  const audio = new Uint8Array(20_000).map((_, i) => (i + setId.length) % 251);
  const b = structuredClone(fixture);
  b.set_id = setId;
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  await new UploadExamSet(sets, storage, sha256).execute({
    actor: admin,
    setJsonText: JSON.stringify(b),
    audio,
  });
  await new SetExamAccess(sets).execute({ actor: admin, setId, access: "members" });
  if (decision)
    await new ReviewExamSet(sets).execute({ actor: teacher, setId, decision });
}

/** 路人的瀏覽器識別：預設是同一個瀏覽器 */
const BROWSER = "browser-1";
const gid = (actor: Account | null, guestId = BROWSER) => (actor ? null : guestId);

const list = (actor: Account | null) =>
  new ListAvailableExams(sets)
    .execute({ actor })
    .then((xs) => xs.map((x) => x.setId).sort());
const start = (actor: Account | null, setId: string, guestId?: string) =>
  new StartExam(sets, attempts).execute({ actor, guestId: gid(actor, guestId), setId });
const submit = (
  actor: Account | null,
  attemptId: string,
  answers: Record<string, unknown>,
  guestId?: string,
) =>
  new SubmitExam(sets, attempts).execute({
    actor,
    guestId: gid(actor, guestId),
    attemptId,
    answers,
  });

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  attempts = new InMemoryAttemptRepository();
  storage = new InMemoryAudioStorage();
  await addSet("s1-public", "approved");
  await addSet("s1-members", "approved");
  await addSet("s1-pending");
  await addSet("s1-rejected", "rejected");
  await new SetExamAccess(sets).execute({
    actor: admin,
    setId: "s1-public",
    access: "public",
  });
  await new SetExamAccess(sets).execute({
    actor: admin,
    setId: "s1-pending",
    access: "public",
  });
});

describe("SetExamAccess", () => {
  it("應該只讓管理員設定開放對象", async () => {
    const r = await new SetExamAccess(sets).execute({
      actor: teacher,
      setId: "s1-members",
      access: "public",
    });
    expect(r.ok).toBe(false);
    expect((await sets.findById("s1-members"))?.access).toBe("members");
  });

  it("應該擋下不合法的開放對象", async () => {
    const r = await new SetExamAccess(sets).execute({
      actor: admin,
      setId: "s1-members",
      access: "vip",
    });
    expect(r.ok).toBe(false);
  });
});

describe("ListAvailableExams", () => {
  it("應該讓路人只看到公開且合格的考卷", async () => {
    expect(await list(guest)).toEqual(["s1-public"]);
  });

  it("應該讓學生、老師看到所有合格的考卷", async () => {
    expect(await list(student)).toEqual(["s1-members", "s1-public"]);
    expect(await list(teacher)).toEqual(["s1-members", "s1-public"]);
  });

  it("應該讓只有管理員角色的帳號一張都看不到", async () => {
    expect(await list(admin)).toEqual([]);
  });
});

describe("StartExam", () => {
  it("應該給考生題目卷與時間軸，不含答案", async () => {
    const r = await start(student, "s1-members");
    if (!r.ok) throw new Error(r.reason);
    expect(r.sheet.paper.title).toBe(fixture.paper.title);
    expect(JSON.stringify(r.sheet)).not.toContain(fixture.answers.answers[0].note);
    expect((await attempts.findById(r.sheet.attemptId))?.accountId).toBe("student");
  });

  it("應該擋下路人考會員考卷、任何人考未合格的考卷", async () => {
    expect((await start(guest, "s1-members")).ok).toBe(false);
    expect((await start(guest, "s1-pending")).ok).toBe(false);
    expect((await start(student, "s1-rejected")).ok).toBe(false);
    expect((await start(admin, "s1-public")).ok).toBe(false);
    expect((await start(student, "nope")).ok).toBe(false);
  });

  it("應該讓路人考公開考卷，作答沒有帳號", async () => {
    const r = await start(guest, "s1-public");
    if (!r.ok) throw new Error(r.reason);
    expect((await attempts.findById(r.sheet.attemptId))?.accountId).toBeNull();
  });
});

describe("SubmitExam", () => {
  it("應該存下這張考卷的答案，只能交一次", async () => {
    const r = await start(student, "s1-members");
    if (!r.ok) throw new Error(r.reason);
    const id = r.sheet.attemptId;
    expect(await submit(student, id, { q01: " 37 ", q99: "hack" })).toEqual({
      ok: true,
      attemptId: id,
    });
    const saved = await attempts.findById(id);
    expect(saved?.answers?.q01).toBe("37");
    expect(saved?.answers && "q99" in saved.answers).toBe(false);
    expect(Object.keys(saved?.answers ?? {})).toHaveLength(10);
    expect(await submit(student, id, { q01: "47" })).toEqual({
      ok: false,
      reason: "already_submitted",
    });
  });

  it("應該不讓別人交別人的卷", async () => {
    const r = await start(student, "s1-members");
    if (!r.ok) throw new Error(r.reason);
    expect(await submit(student2, r.sheet.attemptId, {})).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await submit(guest, r.sheet.attemptId, {})).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("應該讓路人交自己的試寫卷", async () => {
    const r = await start(guest, "s1-public");
    if (!r.ok) throw new Error(r.reason);
    expect((await submit(guest, r.sheet.attemptId, { q01: "37" })).ok).toBe(true);
  });
});

describe("GetExamSetAudio（考生）", () => {
  it("應該讓考生聽能考的考卷，聽不到不能考的", async () => {
    const get = new GetExamSetAudio(sets, storage, new InMemoryRateLimiter());
    expect(
      await get.execute({ actor: guest, setId: "s1-public", requester: null }),
    ).not.toBeNull();
    expect(
      await get.execute({ actor: guest, setId: "s1-members", requester: null }),
    ).toBeNull();
    expect(
      await get.execute({ actor: student, setId: "s1-members", requester: null }),
    ).not.toBeNull();
    expect(
      await get.execute({ actor: student, setId: "s1-pending", requester: null }),
    ).toBeNull();
    expect(
      await get.execute({ actor: teacher, setId: "s1-pending", requester: null }),
    ).not.toBeNull();
  });
});

describe("批改與結果", () => {
  const result = (actor: Account | null, attemptId: string, guestId?: string) =>
    new GetAttemptResult(sets, attempts).execute({
      actor,
      guestId: gid(actor, guestId),
      attemptId,
    });

  it("應該在交卷時批改，結果頁看得到分數、每題對錯與正解", async () => {
    const r = await start(student, "s1-members");
    if (!r.ok) throw new Error(r.reason);
    const id = r.sheet.attemptId;
    // q01 標準答案 37（只寫數字）、q02 Maple Court、q07 morning（也接受 mornings）
    await submit(student, id, {
      q01: "37",
      q02: "maple court",
      q07: "mornings",
      q03: "Brantwod",
    });
    const v = await result(student, id);
    expect(v?.total).toBe(10);
    expect(v?.score).toBe(3);
    const byQ = Object.fromEntries((v?.results ?? []).map((x) => [x.questionId, x]));
    expect(byQ.q01).toMatchObject({ number: 1, correct: true, expected: "37" });
    expect(byQ.q03).toMatchObject({
      correct: false,
      given: "Brantwod",
      expected: "Brantwood",
    });
    expect(byQ.q04.correct).toBe(false);
  });

  it("應該只讓本人看自己的結果；還沒交卷看不到", async () => {
    const r = await start(student, "s1-members");
    if (!r.ok) throw new Error(r.reason);
    expect(await result(student, r.sheet.attemptId)).toBeNull();
    await submit(student, r.sheet.attemptId, {});
    expect(await result(student, r.sheet.attemptId)).not.toBeNull();
    expect(await result(student2, r.sheet.attemptId)).toBeNull();
    expect(await result(guest, r.sheet.attemptId)).toBeNull();
  });

  it("應該讓路人看自己試寫的分數與對錯，但看不到正解", async () => {
    const r = await start(guest, "s1-public");
    if (!r.ok) throw new Error(r.reason);
    await submit(guest, r.sheet.attemptId, { q01: "37" });
    const v = await result(guest, r.sheet.attemptId);
    expect(v?.score).toBe(1);
    expect(v?.answerKeyVisible).toBe(false);
    expect(v?.results.every((x) => x.expected === null && x.accepted.length === 0)).toBe(
      true,
    );
    expect(v?.results[0].correct).toBe(true);
  });

  it("應該不讓別的瀏覽器看或交路人的作答（拿到網址也一樣）", async () => {
    const r = await start(guest, "s1-public");
    if (!r.ok) throw new Error(r.reason);
    expect((await submit(guest, r.sheet.attemptId, {}, "browser-2")).ok).toBe(false);
    await submit(guest, r.sheet.attemptId, {});
    expect(await result(guest, r.sheet.attemptId, "browser-2")).toBeNull();
  });

  it("應該讓路人註冊後，把試寫的作答移到帳號名下並看到正解", async () => {
    const r = await start(guest, "s1-public");
    if (!r.ok) throw new Error(r.reason);
    await submit(guest, r.sheet.attemptId, { q01: "37" });
    const other = await start(guest, "s1-public", "browser-2");
    if (!other.ok) throw new Error(other.reason);

    const claimed = await new ClaimGuestAttempts(attempts).execute({
      accountId: "student",
      guestIds: [BROWSER],
    });
    expect(claimed).toEqual([r.sheet.attemptId]);
    const v = await result(student, r.sheet.attemptId);
    expect(v?.answerKeyVisible).toBe(true);
    expect(v?.results[0].expected).toBe("37");
    // 移走之後，路人身分就看不到了；別的瀏覽器的作答不受影響
    expect(await result(guest, r.sheet.attemptId)).toBeNull();
    expect((await attempts.findById(other.sheet.attemptId))?.accountId).toBeNull();
  });

  it("應該擋下沒有瀏覽器識別的路人", async () => {
    const r = await new StartExam(sets, attempts).execute({
      actor: null,
      guestId: null,
      setId: "s1-public",
    });
    expect(r.ok).toBe(false);
  });
});

describe("ListMyAttempts", () => {
  const history = (actor: Account) =>
    new ListMyAttempts(sets, attempts).execute({ actor });

  it("應該列出自己交過卷的紀錄，新的在前，沒交卷的不列", async () => {
    const first = await start(student, "s1-members");
    const second = await start(student, "s1-public");
    const unfinished = await start(student, "s1-public");
    if (!first.ok || !second.ok || !unfinished.ok) throw new Error("start");
    await submit(student, first.sheet.attemptId, { q01: "37" });
    await new Promise((r) => setTimeout(r, 5));
    await submit(student, second.sheet.attemptId, {});
    const list = await history(student);
    expect(list?.map((x) => [x.attemptId, x.score])).toEqual([
      [second.sheet.attemptId, 0],
      [first.sheet.attemptId, 1],
    ]);
    expect(list?.[0].title).toBe(fixture.title);
  });

  it("應該只列自己的，別人的看不到", async () => {
    const r = await start(student, "s1-members");
    if (!r.ok) throw new Error(r.reason);
    await submit(student, r.sheet.attemptId, {});
    expect(await history(student2)).toEqual([]);
  });

  it("應該不給沒有考試紀錄權限的帳號（只有管理員角色）", async () => {
    expect(await history(admin)).toBeNull();
  });

  it("應該包含註冊前以路人身分試寫、後來移過來的作答", async () => {
    const r = await start(guest, "s1-public");
    if (!r.ok) throw new Error(r.reason);
    await submit(guest, r.sheet.attemptId, { q01: "37" });
    await new ClaimGuestAttempts(attempts).execute({
      accountId: "student",
      guestIds: [BROWSER],
    });
    expect((await history(student))?.map((x) => x.attemptId)).toEqual([
      r.sheet.attemptId,
    ]);
  });
});

describe("跨裝置認領", () => {
  it("應該在 A 瀏覽器寫考卷、B 裝置（沒有路人識別）輸入登入碼時，作答仍移到新帳號", async () => {
    const r = await start(guest, "s1-public", "browser-A");
    if (!r.ok) throw new Error(r.reason);
    await submit(guest, r.sheet.attemptId, { q01: "37" }, "browser-A");
    // 輸入登入碼的 B 裝置沒有 cookie（null）；登入碼裡記的是 A
    const claimed = await new ClaimGuestAttempts(attempts).execute({
      accountId: "student",
      guestIds: ["browser-A", null],
    });
    expect(claimed).toEqual([r.sheet.attemptId]);
    const v = await new GetAttemptResult(sets, attempts).execute({
      actor: student,
      guestId: null,
      attemptId: r.sheet.attemptId,
    });
    expect(v?.answerKeyVisible).toBe(true);
  });

  it("應該合併兩個瀏覽器的作答，新的在前", async () => {
    const a = await start(guest, "s1-public", "browser-A");
    await new Promise((res) => setTimeout(res, 5));
    const b = await start(guest, "s1-public", "browser-B");
    if (!a.ok || !b.ok) throw new Error("start");
    const claimed = await new ClaimGuestAttempts(attempts).execute({
      accountId: "student",
      guestIds: ["browser-A", "browser-B", "browser-A"],
    });
    expect(claimed).toEqual([b.sheet.attemptId, a.sheet.attemptId]);
  });
});
