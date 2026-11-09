import { beforeEach, describe, expect, it } from "vitest";
import { SetExamAccess } from "./setExamAccess";
import { GetTrialExam } from "@/application/exam/getTrialExam";
import type { Account } from "@/domain/account/account";
import type { ExamSet } from "@/domain/examSet/examSet";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";

const admin: Account = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@marsen.me",
  roles: ["admin"],
  createdAt: new Date(),
};

function examSet(setId: string, over: Partial<ExamSet> = {}): ExamSet {
  return {
    setId,
    title: `Title ${setId}`,
    topic: "topic",
    questionCount: 10,
    paper: {},
    timing: { totalSeconds: 0, events: [] },
    audioKey: `${setId}.mp3`,
    aiVerdict: "pass",
    schemaMinor: 0,
    status: "pending_review",
    access: "unlisted",
    uploadedBy: admin.id,
    uploadedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

let sets: InMemoryExamSetRepository;
const setAccess = (setId: string, access: string) =>
  new SetExamAccess(sets).execute({ actor: admin, setId, access });
const trial = () => new GetTrialExam(sets).execute();
const accessOf = async (setId: string) => (await sets.findById(setId))?.access;

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  for (const s of [examSet("A"), examSet("B"), examSet("C", { access: "members" })])
    await sets.save(s, { setId: s.setId, answers: {}, provenance: {}, transcript: null });
});

describe("公開考卷全站只有一張", () => {
  it("應該在沒有公開考卷時，首頁試考是 null", async () => {
    expect(await trial()).toBeNull();
  });

  it("應該讓待審的題組也能設成公開，並成為首頁試考", async () => {
    expect(await setAccess("A", "public")).toEqual({ ok: true });
    expect(await trial()).toEqual({ setId: "A" });
  });

  it("應該在設另一張為公開時，把原本公開的改成上架", async () => {
    await setAccess("A", "public");
    await setAccess("B", "public");
    expect(await accessOf("A")).toBe("members");
    expect(await accessOf("B")).toBe("public");
    expect(await accessOf("C")).toBe("members");
    expect(await trial()).toEqual({ setId: "B" });
  });

  it("應該在公開的改成下架後，沒有首頁試考", async () => {
    await setAccess("A", "public");
    await setAccess("A", "unlisted");
    expect(await trial()).toBeNull();
  });
});
