// 測驗頁的純邏輯：評分、倒數顯示。不碰 DOM，方便單元測試。
import { grade } from "../generator/grade.mjs";

// 評分：每題對錯、你寫的、正解，加上題號（照表格由上到下）。
export function gradeAnswers(plan, answers) {
  const g = grade(plan, answers);
  return { total: g.total, count: g.results.length, results: g.results.map((r, i) => ({ number: i + 1, question_id: r.question_id, given: r.given, expected: r.expected, correct: r.correct })) };
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
