import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { UploadExamSet } from "./uploadExamSet";
import type { Account } from "@/domain/account/account";
import { blanksOf } from "@/domain/exam/paper";
import { sectionRangesOf } from "@/domain/examSet/fullExam";
import { parseAnswerKey } from "./answerKey";
import { buildReviewView } from "./reviewView";
import { narratorVoicesOf } from "./narratorVoices";
import { InMemoryExamSetRepository } from "@/infrastructure/persistence/inMemoryExamSetRepository";
import { InMemoryAudioStorage } from "@/infrastructure/storage/inMemoryAudioStorage";
import { NodeSha256 } from "@/infrastructure/crypto/nodeSha256";

// 出題工具實際產出的完整考卷（s1-tour-0002，四段 40 題）；錄音換成假的，雜湊和大小改成對得上
const sha256 = new NodeSha256();
const fixture = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/exam.sample.json", import.meta.url),
    "utf8",
  ),
);

function exam(overrides: (b: typeof fixture) => void = () => {}) {
  const audio = new Uint8Array(20_000).map((_, i) => i % 251);
  const b = structuredClone(fixture);
  b.audio = { ...b.audio, bytes: audio.byteLength, sha256: sha256.hex(audio) };
  overrides(b);
  return { setJsonText: JSON.stringify(b), audio };
}

const admin: Account = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "a@marsen.me",
  roles: ["admin"],
  createdAt: new Date(),
};

let sets: InMemoryExamSetRepository;
const upload = (input: ReturnType<typeof exam>) =>
  new UploadExamSet(sets, new InMemoryAudioStorage(), sha256).execute({
    actor: admin,
    ...input,
  });

beforeEach(() => {
  sets = new InMemoryExamSetRepository();
});

describe("上傳完整考卷（set.json 3.0）", () => {
  it("收下四段 40 題，題目卷照段落存、答案卡接成 40 題", async () => {
    const r = await upload(exam());
    expect(r).toMatchObject({ ok: true, setId: "s1-tour-0002", outcome: "created" });
    const set = await sets.findById("s1-tour-0002");
    const secret = sets.privateOf("s1-tour-0002");
    expect(set?.questionCount).toBe(40);
    expect(set?.status).toBe("pending_review");
    expect(sectionRangesOf(set!.paper)).toEqual([
      { section: 1, first: 1, last: 10 },
      { section: 2, first: 11, last: 20 },
      { section: 3, first: 21, last: 30 },
      { section: 4, first: 31, last: 40 },
    ]);
    expect(blanksOf(set!.paper)).toHaveLength(40);
    const key = parseAnswerKey(secret!.answers);
    expect(key.ok && key.entries.map((e) => e.questionId)).toEqual(blanksOf(set!.paper));
    expect(key.ok && key.entries.find((e) => e.questionId === "q11")?.policy).toBe(
      "letter",
    );
    // 逐字稿四段接起來，考生那份時間軸不帶文字
    expect(secret?.transcript?.turns[0].id).toBe("s1-t1");
    expect(secret?.transcript?.evidence).toHaveLength(40);
    // 示警 id 加段落前綴，AI 發現帶段落
    const prov = secret!.provenance as {
      warnings: { id: string }[];
      ai_review: { findings: { ielts_section: number }[] };
      sections: unknown[];
    };
    expect(prov.warnings.map((w) => w.id)).toEqual(["s4-w01"]);
    expect(prov.ai_review.findings.some((f) => f.ielts_section === 3)).toBe(true);
    expect(prov.sections).toHaveLength(4);
  });

  it("審稿頁：AI 意見帶所屬段落（明寫的、題目所在段、示警編號前綴）", async () => {
    await upload(exam());
    const set = (await sets.findById("s1-tour-0002"))!;
    const view = buildReviewView(set, sets.privateOf("s1-tour-0002")!, null);
    expect(view.aiNotes.length).toBeGreaterThan(0);
    expect(view.aiNotes.every((n) => n.ieltsSection !== null)).toBe(true);
    expect(view.aiNotes.find((n) => n.warningId === "s4-w01")?.ieltsSection).toBe(4);
    expect(view.aiNotes.some((n) => n.kind === "finding" && n.ieltsSection === 3)).toBe(
      true,
    );
    for (const n of view.aiNotes.filter((x) => x.questionId))
      expect(n.ieltsSection).toBe(
        view.questions.find((q) => q.questionId === n.questionId)?.ieltsSection,
      );
  });

  it("審稿頁：每段的旁白（answers.cast）存進製作紀錄，四段照順序讀得到", async () => {
    await upload(exam());
    const voices = narratorVoicesOf(sets.privateOf("s1-tour-0002")!, true);
    expect(voices.map((s) => s.ieltsSection)).toEqual([1, 2, 3, 4]);
    expect(voices.map((s) => s.narrators.map((n) => n.role))).toEqual([
      ["A", "B"],
      ["A"],
      ["A", "B"],
      ["A"],
    ]);
    // Section 1 是舊資料，沒有 engine
    expect(voices[0].narrators[0]).toMatchObject({ voice: "bm_daniel", engine: null });
    expect(voices[2].narrators[1]).toMatchObject({
      voice: "breeze-us-f-middle-1",
      engine: "breeze",
      accent: "en-US",
      gender: "f",
      age: "middle",
    });
  });

  it("題組列表的摘要：完整考卷是 3.0（大版號由內容判斷）", async () => {
    await upload(exam());
    const [summary] = await sets.listSummaries({});
    expect(summary).toMatchObject({
      setId: "s1-tour-0002",
      schemaVersion: 3,
      schemaMinor: 0,
    });
  });

  it("單選的答案不是選項裡的字母就擋下", async () => {
    const r = await upload(
      exam((b) => {
        b.sections[1].answers.answers[0].answer = "D";
      }),
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems[0]).toMatchObject({
      code: "schemaField",
      path: "sections.1.answers.answers.0.answer",
    });
  });

  it("配對的選項不夠多（要比項目多 2 個以上）就擋下", async () => {
    const r = await upload(
      exam((b) => {
        b.sections[1].paper.blocks[1].options.splice(5);
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("錄音雜湊對不上照樣擋下", async () => {
    const r = await upload(
      exam((b) => {
        b.audio.sha256 = "0".repeat(64);
      }),
    );
    expect(!r.ok && r.problems.map((p) => p.code)).toContain("audioMismatch");
  });

  it("逐字稿和時間軸對不上照樣擋下", async () => {
    const r = await upload(
      exam((b) => {
        b.sections[3].transcript.turns.pop();
      }),
    );
    expect(!r.ok && r.problems.map((p) => p.code)).toContain("transcriptTimingMismatch");
  });
});
