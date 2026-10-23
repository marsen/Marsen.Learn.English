import type { AiNote, ReviewView } from "@/application/examSet/reviewView";

/** [mm:ss] */
const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}]`;
};

/**
 * 老師審稿的回饋，整理成給 AI 看的文字（管理員複製後貼給 AI 修題，或存成
 * Question.Generator 的 prompts/script.feedback.md）。給 AI 讀，所以標題用英文。
 *
 * 內容：判定、整體意見；整套／錄音的意見；每一題的題目、答案、陷阱、出處，
 * 以及 AI 的意見（老師同意、改寫、或認為不是問題）和老師的意見；最後附逐字稿。
 */
export function reviewFeedback(view: ReviewView, reviewerEmail: string | null): string {
  const review = view.review;
  const actions = new Map((review?.aiActions ?? []).map((a) => [a.ref, a]));
  const notes = review?.notes ?? [];

  const aiLine = (n: AiNote) => {
    const source =
      n.kind === "warning"
        ? `Checker warning ${[n.warningId, n.rule].filter(Boolean).join(" ")}${n.aiRuling ? ` · AI ruling: ${n.aiRuling}` : ""}`
        : `AI review · ${[n.category, n.severity].filter(Boolean).join(" · ")}`;
    const suggestion = n.suggestion ? ` Suggestion: ${n.suggestion}` : "";
    const a = actions.get(n.ref);
    if (!a) return `- [${source} · teacher agrees] ${n.message}${suggestion}`;
    if (a.action === "edited")
      return `- [${source} · teacher rewrote] Teacher: ${a.text}\n  AI original: ${n.message}${suggestion}`;
    return `- [${source} · teacher says NOT a problem${a.text ? `: ${a.text}` : ""}] ${n.message}${suggestion}`;
  };
  const commentsFor = (target: string | null) => [
    ...view.aiNotes.filter((n) => n.questionId === target).map(aiLine),
    ...notes.filter((n) => n.target === target).map((n) => `- [Teacher] ${n.text}`),
  ];
  const orNone = (lines: string[], none: string) => (lines.length > 0 ? lines : [none]);

  const decision = review
    ? review.decision === "approved"
      ? "APPROVED"
      : "REJECTED"
    : "NOT REVIEWED";
  const lines = [
    `# Teacher review: ${view.set.setId} (${view.set.title})`,
    `Decision: ${decision}`,
  ];
  if (review)
    lines.push(
      `Reviewer: ${reviewerEmail ?? "teacher"} · ${review.reviewedAt.toISOString().slice(0, 10)}`,
    );
  if (review?.comment) lines.push(`Overall comment: ${review.comment}`);

  lines.push("", "## Whole set / audio", ...orNone(commentsFor(null), "- (none)"));

  lines.push("", "## Questions");
  for (const q of view.questions) {
    lines.push(`### ${q.questionId} · Q${q.number}${q.label ? ` · ${q.label}` : ""}`);
    const facts = [
      `Answer: ${q.answer}${q.accepted.length > 0 ? ` (also accepted: ${q.accepted.join(", ")})` : ""}`,
      q.answerType && `type ${q.answerType}`,
      q.answerPolicy && `policy ${q.answerPolicy}`,
      q.trap && `trap ${q.trap}${q.wrongValue ? ` (wrong value: ${q.wrongValue})` : ""}`,
      q.evidence &&
        `evidence ${q.evidence.turn}${q.evidence.start !== null ? ` ${clock(q.evidence.start)}` : ""}`,
    ];
    lines.push(facts.filter(Boolean).join(" · "));
    lines.push(...orNone(commentsFor(q.questionId), "- no comments"));
  }

  if (view.turns) {
    lines.push("", "## Transcript (turn · start · speaker)");
    for (const t of view.turns)
      lines.push(
        `${t.id}${t.start !== null ? ` ${clock(t.start)}` : ""} ${t.speaker}: ${t.text}`,
      );
  }
  return lines.join("\n");
}
