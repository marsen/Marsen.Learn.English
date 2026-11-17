import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "@/application/examSet/uploadExamSet";
import { ReviewExamSet } from "@/application/examSet/reviewExamSet";
import { SetExamAccess } from "@/application/examSet/setExamAccess";
import { GetExamSetForReview } from "@/application/examSet/getExamSetForReview";
import { StartExam } from "./startExam";
import { SubmitExam } from "./submitExam";
import { GetAttemptResult } from "./getAttemptResult";
import type { Account } from "@/domain/account/account";
import type { Role } from "@/domain/account/role";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAttemptRepository } from "@/infrastructure/persistence/inMemoryAttemptRepository";
import { InMemoryAudioStorage } from "@/infrastructure/storage/inMemoryAudioStorage";
import { NodeSha256 } from "@/infrastructure/crypto/nodeSha256";

// 完整考卷（出題工具實際產出的 s1-tour-0002，四段 40 題）走完：上傳 → 審稿 → 考試 → 批改 → 成績
const sha256 = new NodeSha256();
const fixture = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/exam.sample.json", import.meta.url),
    "utf8",
  ),
);
const SET_ID = "s1-tour-0002";

const account = (id: string, roles: Role[]): Account => ({
  id,
  email: `${id}@marsen.me`,
  roles,
  createdAt: new Date(),
});
const admin = account("admin", ["admin"]);
const teacher = account("teacher", ["teacher"]);
const student = account("student", ["student"]);

/** 標準答案（題號 → 答案）直接從 fixture 拿 */
const key: Record<string, string> = Object.fromEntries(
  fixture.sections.flatMap(
    (s: { answers: { answers: { question_id: string; answer: string }[] } }) =>
      s.answers.answers.map((a) => [a.question_id, a.answer]),
  ),
);
const ids = Object.keys(key);

let sets: InMemoryExamSetRepository;
let attempts: InMemoryAttemptRepository;

beforeEach(async () => {
  sets = new InMemoryExamSetRepository();
  attempts = new InMemoryAttemptRepository();
  const audio = new Uint8Array(20_000).map((_, i) => i % 251);
  const b = structuredClone(fixture);
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  const up = await new UploadExamSet(sets, new InMemoryAudioStorage(), sha256).execute({
    actor: admin,
    setJsonText: JSON.stringify(b),
    audio,
  });
  if (!up.ok) throw new Error(JSON.stringify(up.problems));
});

describe("完整考卷：審稿", () => {
  it("四段 40 題都能判；單選、配對看得到選項、答案、依據", async () => {
    const r = await new GetExamSetForReview(sets).execute({
      actor: teacher,
      setId: SET_ID,
    });
    if (!r.ok) throw new Error(r.reason);
    const qs = r.view.questions;
    expect(qs).toHaveLength(40);
    expect(new Set(qs.map((q) => q.ieltsSection))).toEqual(new Set([1, 2, 3, 4]));
    const q11 = qs.find((q) => q.questionId === "q11")!;
    expect(q11).toMatchObject({
      number: 11,
      ieltsSection: 2,
      answer: "B",
      answerPolicy: "letter",
      label: "Before their first shift, all new volunteers must",
    });
    expect(q11.options?.map((o) => o.key)).toEqual(["A", "B", "C"]);
    expect(q11.note).toBeTruthy();
    expect(q11.evidence?.turn).toMatch(/^s2-t/);
    const q16 = qs.find((q) => q.questionId === "q16")!;
    expect(q16.options).toHaveLength(7);
    expect(q16.label).toBe("Garden team");
    const q31 = qs.find((q) => q.questionId === "q31")!;
    expect(q31).toMatchObject({ number: 31, ieltsSection: 4, options: null });
    expect(r.view.fullPaper?.sections).toHaveLength(4);

    const verdicts = [
      { target: null, ok: true },
      ...ids.map((q) => ({ target: q, ok: true })),
    ];
    expect(
      await new ReviewExamSet(sets).execute({ actor: teacher, setId: SET_ID, verdicts }),
    ).toEqual({ ok: true });
    expect((await sets.findById(SET_ID))?.status).toBe("approved");
  });
});

describe("完整考卷：考試與成績", () => {
  beforeEach(async () => {
    const verdicts = [
      { target: null, ok: true },
      ...ids.map((q) => ({ target: q, ok: true })),
    ];
    await new ReviewExamSet(sets).execute({ actor: teacher, setId: SET_ID, verdicts });
    await new SetExamAccess(sets).execute({
      actor: admin,
      setId: SET_ID,
      access: "members",
    });
  });

  it("交卷批改：單選配對只比字母；成績有總分、級分、各段", async () => {
    const started = await new StartExam(sets, attempts).execute({
      actor: student,
      guestId: null,
      setId: SET_ID,
    });
    if (!started.ok) throw new Error(started.reason);
    expect(started.sheet.fullPaper?.sections).toHaveLength(4);

    // Section 1 全對、Section 2 單選用小寫加空白（算對）、配對全錯、Section 3、4 空白
    const answers: Record<string, string> = {};
    for (const id of ids.slice(0, 10)) answers[id] = key[id];
    for (const id of ids.slice(10, 15)) answers[id] = ` ${key[id].toLowerCase()} `;
    for (const id of ids.slice(15, 20)) answers[id] = key[id] === "A" ? "B" : "A";
    const sub = await new SubmitExam(sets, attempts).execute({
      actor: student,
      guestId: null,
      attemptId: started.sheet.attemptId,
      answers,
    });
    expect(sub).toEqual({ ok: true, attemptId: started.sheet.attemptId });

    const v = await new GetAttemptResult(sets, attempts).execute({
      actor: student,
      guestId: null,
      attemptId: started.sheet.attemptId,
    });
    expect(v?.total).toBe(40);
    expect(v?.score).toBe(15);
    expect(v?.band).toBe(4.5);
    expect(v?.sections).toEqual([
      { section: 1, correct: 10, total: 10 },
      { section: 2, correct: 5, total: 10 },
      { section: 3, correct: 0, total: 10 },
      { section: 4, correct: 0, total: 10 },
    ]);
    expect(v?.results.find((x) => x.questionId === "q31")?.number).toBe(31);
  });
});
