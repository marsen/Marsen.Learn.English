import { matchesAnswer } from "./answer.mjs";

// 盲答只是警示，不是裁決：不一致或有備選答案，都要人工判斷。
export function compareBlind({ plan, check }) {
  const issues = [];
  const byId = new Map((check.answers ?? []).map((a) => [a.question_id, a]));
  for (const a of plan.answers) {
    const b = byId.get(a.question_id);
    if (!b) { issues.push({ rule: "B1", level: "warn", question_id: a.question_id, message: "盲答沒有回答這一題" }); continue; }
    if (!matchesAnswer(a.answer_policy, b.answer ?? "", a)) {
      issues.push({ rule: "B1", level: "warn", question_id: a.question_id, message: `盲答寫「${b.answer}」，標準答案是「${a.answer}」（${a.trap}）` });
    }
    if ((b.alternatives ?? []).length) {
      issues.push({ rule: "B2", level: "warn", question_id: a.question_id, message: `盲答認為還有可能的答案：${b.alternatives.join("、")}` });
    }
    if (b.confidence === "low") issues.push({ rule: "B3", level: "warn", question_id: a.question_id, message: "盲答信心低" });
  }
  return { ok: issues.length === 0, issues };
}
