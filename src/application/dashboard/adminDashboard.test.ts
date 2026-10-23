import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { GetAdminDashboard, feedbackText } from "./adminDashboard";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { SetExamAccess } from "@/application/examSet/setExamAccess";
import { DeleteExamSet } from "@/application/examSet/deleteExamSet";
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
let attempts: InMemoryAttemptRepository;
let storage: InMemoryAudioStorage;
let admin: Account;
let teacher: Account;

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

const review = (setId: string, decision: "approved" | "rejected", comment?: string) =>
  new ReviewExamSet(sets).execute({
    actor: teacher,
    setId,
    decision,
    comment,
    notes: decision === "rejected" ? [{ target: "q07", text: "答案卡太窄" }] : [],
  });

const dashboard = (actor: Account) =>
  new GetAdminDashboard(sets, accounts).execute({ actor });

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  accounts = new InMemoryAccountRepository();
  attempts = new InMemoryAttemptRepository();
  storage = new InMemoryAudioStorage();
  admin = await make("admin@marsen.me", ["admin"]);
  teacher = await make("wang@marsen.me", ["teacher"]);
  for (const id of ["s1-a", "s1-b", "s1-c", "s1-d"]) await addSet(id);
  await review("s1-a", "approved");
  await review("s1-b", "approved");
  await new SetExamAccess(sets).execute({
    actor: admin,
    setId: "s1-b",
    access: "members",
  });
  await review("s1-c", "rejected", "情境跟錄音對不上");
});

describe("GetAdminDashboard", () => {
  it("應該算出各種狀態的數量", async () => {
    expect((await dashboard(admin))?.counts).toEqual({
      pending: 1,
      readyToList: 1,
      rejected: 1,
      listed: 1,
      public: 0,
    });
  });

  it("應該列出老師通過、還沒上架的題組與審稿老師", async () => {
    const view = await dashboard(admin);
    expect(view?.readyToList.map((r) => r.set.setId)).toEqual(["s1-a"]);
    expect(view?.readyToList[0].reviewerEmail).toBe("wang@marsen.me");
  });

  it("應該列出老師退回的題組與回饋", async () => {
    const [r] = (await dashboard(admin))?.rejected ?? [];
    expect(r.set.setId).toBe("s1-c");
    expect(r.comment).toBe("情境跟錄音對不上");
    expect(feedbackText(r)).toContain("q07：答案卡太窄");
  });

  it("應該不給沒有上架權限的人看（老師）", async () => {
    expect(await dashboard(teacher)).toBeNull();
  });
});

describe("DeleteExamSet", () => {
  const del = (actor: Account, setId: string) =>
    new DeleteExamSet(sets, attempts, storage).execute({ actor, setId });

  it("應該刪掉退回的題組與音檔", async () => {
    const audioKey = (await sets.findById("s1-c"))!.audioKey;
    expect((await del(admin, "s1-c")).ok).toBe(true);
    expect(await sets.findById("s1-c")).toBeNull();
    expect(await storage.get(audioKey)).toBeNull();
  });

  it("應該不刪合格的題組", async () => {
    expect((await del(admin, "s1-a")).ok).toBe(false);
  });

  it("應該不刪有人寫過的題組", async () => {
    await attempts.create({
      setId: "s1-c",
      accountId: null,
      guestId: "g",
      startedAt: new Date(),
    });
    expect((await del(admin, "s1-c")).ok).toBe(false);
  });

  it("應該只讓管理員刪", async () => {
    expect((await del(teacher, "s1-c")).ok).toBe(false);
  });
});
