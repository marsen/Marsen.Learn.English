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
    // 只是寫法不同、比對規則本來就判對的備選，不算歧義
    const real = (b.alternatives ?? []).filter((x) => !matchesAnswer(a.answer_policy, x, a));
    if (real.length) {
      issues.push({ rule: "B2", level: "warn", question_id: a.question_id, message: `盲答認為還有可能的答案：${real.join("、")}` });
    }
    if (b.confidence === "low") issues.push({ rule: "B3", level: "warn", question_id: a.question_id, message: "盲答信心低" });
  }
  return { ok: issues.length === 0, issues };
}
