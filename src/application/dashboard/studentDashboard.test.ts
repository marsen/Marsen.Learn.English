import { verdictsFor } from "../../../tests/reviewVerdicts";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { GetStudentDashboard } from "./studentDashboard";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { SetExamAccess } from "@/application/examSet/setExamAccess";
import { StartExam } from "@/application/exam/startExam";
import { SubmitExam } from "@/application/exam/submitExam";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryAttemptRepository } from "@/infrastructure/persistence/inMemoryAttemptRepository";
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
const ALL_CORRECT: Record<string, string> = Object.fromEntries(
  fixture.answers.answers.map((a: { question_id: string; answer: string }) => [
    a.question_id,
    String(a.answer),
  ]),
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

let sets: InMemoryExamSetRepository;
let attempts: InMemoryAttemptRepository;

async function addListedSet(setId: string) {
  const audio = new Uint8Array(20_000).map((_, i) => (i + setId.length) % 251);
  const b = structuredClone(fixture);
  b.set_id = setId;
  b.title = `Title ${setId}`;
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  await new UploadExamSet(sets, new InMemoryAudioStorage(), sha256).execute({
    actor: admin,
    setJsonText: JSON.stringify(b),
    audio,
  });
  await new ReviewExamSet(sets).execute({
    actor: teacher,
    setId,
    verdicts: verdictsFor("approved"),
  });
  await new SetExamAccess(sets).execute({ actor: admin, setId, access: "members" });
}

async function take(setId: string, answers: Record<string, string>) {
  const r = await new StartExam(sets, attempts).execute({
    actor: student,
    guestId: null,
    setId,
  });
  if (!r.ok) throw new Error(r.reason);
  await new SubmitExam(sets, attempts).execute({
    actor: student,
    guestId: null,
    attemptId: r.sheet.attemptId,
    answers,
  });
}

const dashboard = (actor: Account) =>
  new GetStudentDashboard(sets, attempts).execute({ actor });

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  attempts = new InMemoryAttemptRepository();
  await addListedSet("s1-a");
  await addListedSet("s1-b");
});

describe("GetStudentDashboard", () => {
  it("應該在還沒考過時推一張新考卷", async () => {
    const view = await dashboard(student);
    expect(view?.recommendation?.reason).toBe("new");
    expect(view?.notTakenCount).toBe(2);
    expect(view?.attemptCount).toBe(0);
    expect(view?.averagePercent).toBeNull();
    expect(view?.weakTraps).toEqual([]);
  });

  it("應該算出成績與最常錯的題型", async () => {
    await take("s1-a", { q01: "37" }); // 只對 1 題
    const view = await dashboard(student);
    expect(view?.recommendation).toMatchObject({ setId: "s1-b", reason: "new" });
    expect(view?.notTakenCount).toBe(1);
    expect(view?.attemptCount).toBe(1);
    expect(view?.averagePercent).toBe(10);
    expect(view?.recent).toEqual([
      expect.objectContaining({ title: "Title s1-a", score: 1, total: 10 }),
    ]);
    expect(view?.weakTraps[0]).toEqual({ trap: "similar_numbers", wrong: 3, seen: 3 });
    expect(view?.weakTraps).toHaveLength(3);
  });

  it("應該在全部考過後，推分數最低的那套再挑戰", async () => {
    await take("s1-a", { q01: "37" });
    await take("s1-b", ALL_CORRECT);
    const view = await dashboard(student);
    expect(view?.recommendation).toMatchObject({
      setId: "s1-a",
      reason: "retry",
      bestPercent: 10,
    });
    expect(view?.notTakenCount).toBe(0);
    expect(view?.averagePercent).toBe(55);
  });

  it("應該不給沒有考試紀錄權限的人看（只有管理員角色）", async () => {
    expect(await dashboard(admin)).toBeNull();
  });
});
