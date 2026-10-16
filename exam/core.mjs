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

// 錄音時間軸（timing.json）：目前播放秒數落在哪個事件。事件之間的短空檔回傳 null，畫面維持上一個狀態。
export function eventAt(events, t) {
  return events.find((e) => t >= e.start && t < e.end) ?? null;
}

// 事件轉成畫面要顯示的狀態：kind = listen（聽）／read（看題停頓）／check（最後檢查），
// remaining = 停頓還剩幾秒（只有停頓有），questions = 停頓時要看的題號範圍。
export function viewOf(event, t) {
  if (!event) return null;
  if (event.type === "pause") {
    const kind = event.id === "check" ? "check" : "read";
    return { kind, remaining: Math.max(0, event.end - t), questions: kind === "check" ? null : event.questions };
  }
  return { kind: "listen", remaining: 0, questions: null };
}

export function questionLabel(range) {
  const [a, b] = range;
  return a === b ? `第 ${a} 題` : b - a === 1 ? `第 ${a}、${b} 題` : `第 ${a}–${b} 題`;
}
