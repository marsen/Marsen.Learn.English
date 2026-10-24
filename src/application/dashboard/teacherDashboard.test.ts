import { verdictsFor } from "../../../tests/reviewVerdicts";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { GetTeacherDashboard } from "./teacherDashboard";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
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
const otherTeacher = account("teacher2", ["teacher"]);
const student = account("student", ["student"]);

let sets: InMemoryExamSetRepository;

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  const audio = new Uint8Array(20_000).map((_, i) => i % 251);
  const b = structuredClone(fixture);
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  await new UploadExamSet(sets, new InMemoryAudioStorage(), sha256).execute({
    actor: admin,
    setJsonText: JSON.stringify(b),
    audio,
  });
});

const dashboard = (actor: Account, now = new Date()) =>
  new GetTeacherDashboard(sets).execute({ actor, now });

describe("GetTeacherDashboard", () => {
  it("應該列出還沒審的題組與 AI 疑點數", async () => {
    const view = await dashboard(teacher);
    expect(view?.pending.map((p) => p.setId)).toEqual([SET]);
    expect(view?.pending[0].findingCount).toBeGreaterThan(0);
    expect(view?.reviewedThisMonth).toBe(0);
  });

  it("應該在任何一位老師審完後，從所有老師的待審清單拿掉", async () => {
    await new ReviewExamSet(sets).execute({
      actor: otherTeacher,
      setId: SET,
      verdicts: verdictsFor("rejected"),
    });
    expect((await dashboard(teacher))?.pending).toEqual([]);
    expect((await dashboard(teacher))?.reviewedThisMonth).toBe(0);
    expect((await dashboard(otherTeacher))?.reviewedThisMonth).toBe(1);
  });

  it("應該只算這個月審的", async () => {
    await new ReviewExamSet(sets).execute({
      actor: teacher,
      setId: SET,
      verdicts: verdictsFor("approved"),
    });
    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 15);
    expect((await dashboard(teacher, nextMonth))?.reviewedThisMonth).toBe(0);
  });

  it("應該不給沒有審稿權限的人看（管理員、學生）", async () => {
    expect(await dashboard(admin)).toBeNull();
    expect(await dashboard(student)).toBeNull();
  });
});
