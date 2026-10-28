import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildReviewView } from "@/application/examSet/reviewView";
import { toPublicTiming } from "@/domain/examSet/bundle";
import type { ExamSet, Transcript } from "@/domain/examSet/examSet";
import type { TeacherReview } from "@/domain/examSet/review";
import { reviewFeedback } from "./reviewFeedback";

const b = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/set.sample.json", import.meta.url),
    "utf8",
  ),
);
const set: ExamSet = {
  setId: b.set_id,
  title: b.title,
  topic: b.topic,
  questionCount: b.question_count,
  paper: b.paper,
  timing: toPublicTiming(b.timing),
  audioKey: "k",
  aiVerdict: "needs_human",
  schemaMinor: 0,
  status: "rejected",
  access: "unlisted",
  uploadedBy: "u",
  uploadedAt: new Date(),
};
const turnIds: string[] = b.timing.events
  .filter((e: { type: string }) => e.type === "turn")
  .map((e: { id: string }) => e.id);
const transcript: Transcript = {
  turns: turnIds.map((id) => ({ id, speaker: "A", text: `line ${id}` })),
  evidence: b.answers.answers.map((a: { question_id: string }, i: number) => ({
    questionId: a.question_id,
    turn: turnIds[i],
    quote: `line ${turnIds[i]}`,
  })),
};
const review: TeacherReview = {
  setId: b.set_id,
  reviewerId: "t",
  decision: "rejected",
  verdicts: [
    { target: null, ok: true },
    { target: "q07", ok: false },
  ],
  comment: "Fix q07",
  notes: [
    { target: null, text: "[01:23] too fast" },
    { target: "q07", text: "accept early morning" },
  ],
  aiActions: [
    { ref: "finding:0", action: "edited", text: "Rewrite the line instead" },
    { ref: "finding:1", action: "deleted", text: "fine as is" },
  ],
  reviewedAt: new Date("2026-10-23T08:00:00Z"),
};
const secret = { setId: b.set_id, answers: b.answers, provenance: b.provenance };

describe("reviewFeedback", () => {
  it("應該帶上判定、整體意見、整套與每題的意見、AI 意見與老師的處理、逐字稿", () => {
    const text = reviewFeedback(
      buildReviewView(set, { ...secret, transcript }, review),
      "wang@marsen.me",
    );
    expect(text).toContain(`# Teacher review: ${b.set_id}`);
    expect(text).toContain("Decision: REJECTED");
    expect(text).toContain("Reviewer: wang@marsen.me · 2026-10-23");
    expect(text).toContain("Overall comment: Fix q07");
    const whole = text.slice(
      text.indexOf("## Whole set / audio"),
      text.indexOf("## Questions"),
    );
    expect(whole).toContain("- [Teacher] [01:23] too fast");
    expect(text).toContain("- [Teacher] accept early morning");
    expect(text).toContain("teacher rewrote] Teacher: Rewrite the line instead");
    expect(text).toContain("teacher says NOT a problem: fine as is]");
    expect(text).toContain("teacher agrees]");
    expect(text).toMatch(/### q01 · Q1 · Address · teacher: not checked\nAnswer: 37/);
    expect(text).toContain("q07 · Q7");
    expect(text).toMatch(/### q07 · Q7 [^\n]*· teacher: NEEDS FIXING/);
    expect(text).toContain("## Whole set / audio · teacher: OK");
    expect(text).toContain("## Transcript");
    expect(text).toContain("t1 ");
  });

  it("應該在沒有逐字稿的舊題組省略逐字稿，沒有意見的題目寫 no comments", () => {
    const text = reviewFeedback(
      buildReviewView(set, { ...secret, transcript: null }, null),
      null,
    );
    expect(text).toContain("Decision: NOT REVIEWED");
    expect(text).not.toContain("## Transcript");
    expect(text).toContain("- no comments");
  });
});
