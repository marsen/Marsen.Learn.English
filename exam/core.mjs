// 測驗頁的純邏輯：評分、語音挑選、倒數顯示。不碰 DOM，方便單元測試。
import { grade } from "../generator/grade.mjs";

// 評分：每題對錯、你寫的、正解，加上題號（照表格由上到下）。
export function gradeAnswers(plan, answers) {
  const g = grade(plan, answers);
  return { total: g.total, count: g.results.length, results: g.results.map((r, i) => ({ number: i + 1, question_id: r.question_id, given: r.given, expected: r.expected, correct: r.correct })) };
}

// 挑語音：偏好英式英文，兩個說話者盡量用不同的聲音，沒有第二個聲音就靠音高區分。
export function pickVoices(voices) {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const gb = en.filter((v) => /en[-_]GB/i.test(v.lang));
  const pool = gb.length ? gb : en;
  const first = pool[0] ?? null;
  const second = pool.find((v) => v !== first) ?? first;
  return { A: { voice: first, pitch: 1, rate: 0.92 }, B: { voice: second, pitch: second === first ? 1.25 : 1, rate: 0.92 } };
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
