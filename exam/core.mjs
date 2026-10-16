// 測驗頁的純邏輯：評分結果整理、弱點判斷、語音挑選。不碰 DOM，方便單元測試。
import { grade } from "../generator/grade.mjs";

export const TRAP_LABEL = { self_correction: "先講錯再更正", spelling: "拼字", similar_numbers: "相近數字", paraphrase: "同義改寫", distractor: "干擾選項", none: "無陷阱" };
export const TYPE_LABEL = { name_spelled: "拼字的名字", number: "數字", date: "日期", phone: "電話", place: "地點", word: "一般單字", time: "時間", price: "價錢" };
export const WEAK_MIN_ATTEMPTS = 5; // 同一類型累積至少這麼多題作答，才敢說「常錯」
export const WEAK_RATE = 0.6;

// 評分，並把每題的證據句與題號對應補上，給結果頁的「答案在哪一句、聽這一輪」用。
export function buildResult({ plan, script }, answers) {
  const g = grade(plan, answers);
  const evOf = new Map(script.evidence.map((e) => [e.question_id, e]));
  const turnOf = new Map(script.turns.map((t) => [t.id, t]));
  const results = g.results.map((r, i) => {
    const ev = evOf.get(r.question_id);
    const turn = ev ? turnOf.get(ev.turn) : null;
    return { ...r, number: i + 1, quote: ev?.quote ?? "", turn_id: ev?.turn ?? null, turn_text: turn?.text ?? "" };
  });
  return { ...g, results, count: results.length };
}

// 把這次的 byType、byTrap 併進歷史累計。history 是 { byType, byTrap }，沒有就從空的開始。
export function addToHistory(history, result) {
  const merge = (a = {}, b) => {
    const out = JSON.parse(JSON.stringify(a));
    for (const [k, v] of Object.entries(b)) {
      const o = (out[k] ??= { correct: 0, total: 0 });
      o.correct += v.correct; o.total += v.total;
    }
    return out;
  };
  return { byType: merge(history?.byType, result.byType), byTrap: merge(history?.byTrap, result.byTrap), attempts: (history?.attempts ?? 0) + 1 };
}

// 弱點：累積題數夠多、答對率低，才列出來。沒到門檻就回空陣列，不下結論。
export function weaknesses(history, { key = "byTrap" } = {}) {
  return Object.entries(history?.[key] ?? {})
    .filter(([k, v]) => k !== "none" && v.total >= WEAK_MIN_ATTEMPTS && v.correct / v.total < WEAK_RATE)
    .map(([k, v]) => ({ key: k, rate: v.correct / v.total, total: v.total }))
    .sort((a, b) => a.rate - b.rate);
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
