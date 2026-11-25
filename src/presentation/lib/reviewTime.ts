/**
 * 審稿頁的時間：意見裡的 [mm:ss]、逐字稿的句子編號（t12）都要能點，點了跳到錄音那裡。
 */

export type TimeSegment =
  | { kind: "text"; text: string }
  | { kind: "time"; text: string; seconds: number; turn?: string };

/**
 * [mm:ss]、t12 這種句子編號、完整考卷的 s1-t12（前後不能黏著英數字）。
 * s1-t12 要整個認，不然會被切成「s1-」和「t12」。
 */
const PATTERN =
  /\[(\d{1,2}):(\d{2})\]|(?<![A-Za-z0-9])((?:s\d{1,2}-)?t\d{1,3})(?![A-Za-z0-9])/g;

/**
 * 把一段文字拆成「一般文字」和「可以點的時間」。
 * 句子編號要在 turnStarts 裡找得到才算時間（顯示成 t12 [01:35]），找不到就當一般文字。
 * 完整考卷的逐字稿編號是 s1-t12，AI 意見常只寫 t12：給了 section 就先查 s{section}-t12，
 * 顯示成和逐字稿一樣的 s1-t12。沒有 section（整套的意見）查不到就不猜。
 */
export function splitTimeRefs(
  text: string,
  turnStarts: ReadonlyMap<string, number>,
  section: number | null = null,
): TimeSegment[] {
  const out: TimeSegment[] = [];
  let last = 0;
  const push = (s: TimeSegment) => {
    const prev = out.at(-1);
    if (s.kind === "text" && prev?.kind === "text") prev.text += s.text;
    else out.push(s);
  };
  for (const m of text.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) push({ kind: "text", text: text.slice(last, at) });
    if (m[1] !== undefined) {
      push({ kind: "time", text: m[0], seconds: Number(m[1]) * 60 + Number(m[2]) });
    } else {
      const turn = resolveTurn(m[3], turnStarts, section);
      const start = turn === null ? undefined : turnStarts.get(turn);
      push(
        turn === null || start === undefined
          ? { kind: "text", text: m[0] }
          : { kind: "time", text: `${turn} ${clock(start)}`, seconds: start, turn },
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) push({ kind: "text", text: text.slice(last) });
  return out;
}

/** 句子編號 → 逐字稿裡真正的編號；找不到是 null */
function resolveTurn(
  id: string,
  turnStarts: ReadonlyMap<string, number>,
  section: number | null,
): string | null {
  if (section !== null && /^t\d+$/.test(id)) {
    const full = `s${section}-${id}`;
    if (turnStarts.has(full)) return full;
  }
  return turnStarts.has(id) ? id : null;
}

/** 秒數 → [mm:ss] */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}]`;
}

/** 錄音放到 t 秒時，正在講哪一題的答案（沒有就是 null） */
export function questionAt(
  ranges: readonly { questionId: string; start: number | null; end: number | null }[],
  t: number,
): string | null {
  for (const r of ranges) {
    if (r.start !== null && r.end !== null && t >= r.start && t < r.end)
      return r.questionId;
  }
  return null;
}

/** 正在播哪一句：開始時間不超過 t 的最後一句 */
export function turnAt(
  turns: readonly { id: string; start: number | null }[],
  t: number,
): string | null {
  let now: string | null = null;
  for (const x of turns) if (x.start !== null && x.start <= t) now = x.id;
  return now;
}

/**
 * 批註卡要排在空格的高度，但不能疊在一起：照順序往下排，
 * 每張卡放在「想要的位置」和「上一張卡的底下」兩者中比較低的地方。
 */
export function stackCards(
  cards: readonly { want: number; height: number }[],
  gap: number,
): number[] {
  const tops: number[] = [];
  let bottom = -Infinity;
  for (const c of cards) {
    const top = Math.max(c.want, bottom);
    tops.push(top);
    bottom = top + c.height + gap;
  }
  return tops;
}
