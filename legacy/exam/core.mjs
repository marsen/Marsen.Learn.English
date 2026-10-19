// 測驗頁的純邏輯：倒數顯示、錄音時間軸。不碰 DOM，方便單元測試。
// 批改在伺服器端（api/finish），瀏覽器端沒有標準答案，也不載入批改程式。

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
