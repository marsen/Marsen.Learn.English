import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { SetExamAccess } from "@/application/examSet/setExamAccess";
import { GetExamSetAudio } from "@/application/examSet/getExamSetAudio";
import { ListAvailableExams } from "./listAvailableExams";
import { StartExam } from "./startExam";
import { SubmitExam } from "./submitExam";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAttemptRepository } from "@/infrastructure/persistence/inMemoryAttemptRepository";
import { InMemoryAudioStorage } from "@/infrastructure/storage/inMemoryAudioStorage";
import { NodeSha256 } from "@/infrastructure/crypto/nodeSha256";

const sha256 = new NodeSha256();
const fixture = JSON.parse(
  readFileSync(
    new URL("../examSet/fixtures/set.needs-human.json", import.meta.url),
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
  if (decision)
    await new ReviewExamSet(sets).execute({ actor: teacher, setId, decision });
}

const list = (actor: Account | null) =>
  new ListAvailableExams(sets)
    .execute({ actor })
    .then((xs) => xs.map((x) => x.setId).sort());
const start = (actor: Account | null, setId: string) =>
  new StartExam(sets, attempts).execute({ actor, setId });
const submit = (
  actor: Account | null,
  attemptId: string,
  answers: Record<string, unknown>,
) => new SubmitExam(sets, attempts).execute({ actor, attemptId, answers });

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
    expect(await submit(student, id, { q01: " 52 ", q99: "hack" })).toEqual({ ok: true });
    const saved = await attempts.findById(id);
    expect(saved?.answers?.q01).toBe("52");
    expect(saved?.answers && "q99" in saved.answers).toBe(false);
    expect(Object.keys(saved?.answers ?? {})).toHaveLength(10);
    expect(await submit(student, id, { q01: "62" })).toEqual({
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
    expect(await submit(guest, r.sheet.attemptId, { q01: "52" })).toEqual({ ok: true });
  });
});

describe("GetExamSetAudio（考生）", () => {
  it("應該讓考生聽能考的考卷，聽不到不能考的", async () => {
    const get = new GetExamSetAudio(sets, storage);
    expect(await get.execute({ actor: guest, setId: "s1-public" })).not.toBeNull();
    expect(await get.execute({ actor: guest, setId: "s1-members" })).toBeNull();
    expect(await get.execute({ actor: student, setId: "s1-members" })).not.toBeNull();
    expect(await get.execute({ actor: student, setId: "s1-pending" })).toBeNull();
    expect(await get.execute({ actor: teacher, setId: "s1-pending" })).not.toBeNull();
  });
});
