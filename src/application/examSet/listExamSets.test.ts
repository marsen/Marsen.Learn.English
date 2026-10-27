import { beforeEach, describe, expect, it } from "vitest";
import { ListExamSets, parseExamSetFilter } from "./listExamSets";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import type { ExamSet } from "@/domain/examSet/examSet";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";

const account = (roles: Role[]): Account => ({
  id: "00000000-0000-0000-0000-000000000001",
  email: "a@marsen.me",
  roles,
  createdAt: new Date(),
});
const admin = account(["admin"]);

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
    status: "pending_review",
    access: "unlisted",
    uploadedBy: admin.id,
    uploadedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

let sets: InMemoryExamSetRepository;
const list = (query = {}, actor = admin) =>
  new ListExamSets(sets).execute({ actor, query });

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  const save = (s: ExamSet) =>
    sets.save(s, { setId: s.setId, answers: {}, provenance: {}, transcript: null });
  await save(examSet("s1-library-0001", { uploadedAt: new Date("2026-10-01") }));
  await save(
    examSet("s1-gym-0001", {
      status: "approved",
      access: "unlisted",
      uploadedAt: new Date("2026-10-02"),
    }),
  );
  await save(
    examSet("s1-car-0001", {
      aiVerdict: "needs_human",
      status: "approved",
      access: "public",
      uploadedAt: new Date("2026-10-03"),
    }),
  );
});

describe("ListExamSets 過濾", () => {
  it("應該在沒有條件時列出全部，新上傳的在前面", async () => {
    const r = await list();
    expect(r?.sets.map((s) => s.setId)).toEqual([
      "s1-car-0001",
      "s1-gym-0001",
      "s1-library-0001",
    ]);
    expect(r?.filter).toEqual({});
  });

  it("應該能找出老師通過但還沒上架的題組", async () => {
    const r = await list({ status: "approved", access: "unlisted" });
    expect(r?.sets.map((s) => s.setId)).toEqual(["s1-gym-0001"]);
  });

  it("應該照 AI 結論與關鍵字過濾", async () => {
    expect((await list({ ai: "needs_human" }))?.sets.map((s) => s.setId)).toEqual([
      "s1-car-0001",
    ]);
    expect((await list({ q: " LIBRARY " }))?.sets.map((s) => s.setId)).toEqual([
      "s1-library-0001",
    ]);
  });

  it("應該只回清單欄位，不帶題目卷與時間軸", async () => {
    const [s] = (await list())!.sets;
    expect(s).not.toHaveProperty("paper");
    expect(s).not.toHaveProperty("timing");
  });

  it("應該擋下學生", async () => {
    expect(await list({}, account(["student"]))).toBeNull();
  });
});

describe("parseExamSetFilter", () => {
  it("應該忽略不認得的值與空白關鍵字", () => {
    expect(
      parseExamSetFilter({ status: "oops", ai: "maybe", access: "x", q: "  " }),
    ).toEqual({});
  });

  it("應該把認得的值轉成條件", () => {
    expect(
      parseExamSetFilter({
        status: "rejected",
        ai: "pass",
        access: "members",
        q: " gym ",
      }),
    ).toEqual({
      status: "rejected",
      aiVerdict: "pass",
      access: "members",
      keyword: "gym",
    });
  });
});
