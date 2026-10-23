import { verdictsFor } from "../../../tests/reviewVerdicts";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { GetReviewLog } from "./reviewLog";
import { GetTeacherDashboard } from "./teacherDashboard";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { DeleteExamSet } from "@/application/examSet/deleteExamSet";
import { monthOf, shiftMonth } from "@/application/shared/taipeiMonth";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryAccountRepository } from "@/infrastructure/persistence/inMemoryAccountRepository";
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

let sets: InMemoryExamSetRepository;
let accounts: InMemoryAccountRepository;
let storage: InMemoryAudioStorage;
let admin: Account;
let wang: Account;
let lee: Account;

const make = async (email: string, roles: Role[]): Promise<Account> => {
  const a = await accounts.create(email);
  await accounts.setRoles(a.id, roles);
  return { ...a, roles };
};

async function addSet(setId: string) {
  const audio = new Uint8Array(20_000).map((_, i) => (i + setId.length) % 251);
  const b = structuredClone(fixture);
  b.set_id = setId;
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  await new UploadExamSet(sets, storage, sha256).execute({
    actor: admin,
    setJsonText: JSON.stringify(b),
    audio,
  });
}

const review = (actor: Account, setId: string, decision: "approved" | "rejected") =>
  new ReviewExamSet(sets).execute({ actor, setId, verdicts: verdictsFor(decision) });

const log = (actor: Account, month?: string) =>
  new GetReviewLog(sets, accounts).execute({ actor, month, now: new Date() });

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  accounts = new InMemoryAccountRepository();
  storage = new InMemoryAudioStorage();
  admin = await make("admin@marsen.me", ["admin"]);
  wang = await make("wang@marsen.me", ["teacher"]);
  lee = await make("lee@marsen.me", ["teacher"]);
  for (const id of ["s1-a", "s1-b", "s1-c"]) await addSet(id);
  await review(wang, "s1-a", "approved");
  await review(wang, "s1-b", "rejected");
  await review(wang, "s1-b", "approved"); // 同一套改判，只算一套
  await review(lee, "s1-c", "rejected");
});

describe("GetReviewLog", () => {
  it("應該算出每位老師這個月審了幾套", async () => {
    const view = await log(admin);
    expect(view?.month).toBe(monthOf(new Date()));
    expect(view?.teachers).toEqual([
      { reviewerId: wang.id, email: "wang@marsen.me", sets: 2, approved: 2, rejected: 0 },
      { reviewerId: lee.id, email: "lee@marsen.me", sets: 1, approved: 0, rejected: 1 },
    ]);
    expect(view?.entries).toHaveLength(4);
    expect(view?.nextMonth).toBeNull();
  });

  it("應該在題組刪掉後還留著紀錄", async () => {
    await new DeleteExamSet(sets, new InMemoryAttemptRepository(), storage).execute({
      actor: admin,
      setId: "s1-c",
    });
    const view = await log(admin);
    expect(view?.teachers.find((t) => t.email === "lee@marsen.me")?.sets).toBe(1);
    expect(view?.entries.find((e) => e.setId === "s1-c")?.setTitle).toBe(fixture.title);
    const teacherView = await new GetTeacherDashboard(sets).execute({
      actor: lee,
      now: new Date(),
    });
    expect(teacherView?.reviewedThisMonth).toBe(1);
  });

  it("應該可以看上個月，看不到未來的月份", async () => {
    const last = shiftMonth(monthOf(new Date()), -1);
    expect((await log(admin, last))?.teachers).toEqual([]);
    expect((await log(admin, "2999-01"))?.month).toBe(monthOf(new Date()));
  });

  it("應該只給管理員看", async () => {
    expect(await log(wang)).toBeNull();
  });
});
