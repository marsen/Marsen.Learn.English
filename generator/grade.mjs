import { matchesAnswer } from "./answer.mjs";

// 評分與驗證共用 answer.mjs 的同一套比對。
export function grade(plan, userAnswers) {
  const results = plan.answers.map((a) => {
    const given = userAnswers[a.question_id] ?? "";
    return { question_id: a.question_id, given, expected: a.answer, correct: matchesAnswer(a.answer_policy, given, a), type: a.type, trap: a.trap };
  });
  const tally = (key) => {
    const out = {};
    for (const r of results) { const o = (out[r[key]] ??= { correct: 0, total: 0 }); o.total++; if (r.correct) o.correct++; }
    return out;
  };
  return { total: results.filter((r) => r.correct).length, results, byType: tally("type"), byTrap: tally("trap") };
}
