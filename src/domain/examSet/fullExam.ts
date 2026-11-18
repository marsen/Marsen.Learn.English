import type { JsonObject } from "./examSet";

/**
 * 完整考卷（set.json 3.0：四個 section 合成一份）。
 * 上傳時題目卷存成 { sections: [...] }，所以題目卷有 sections 就是完整考卷；2.x 的題目卷沒有。
 * 各段答對幾題、雅思級分都在讀取時算，作答紀錄的形狀和 2.x 一樣。
 */

/** 一段的全卷題號範圍（Section 4 是 31–40） */
export type SectionRange = { section: number; first: number; last: number };

export function isFullExamPaper(paper: JsonObject): boolean {
  return Array.isArray(paper.sections);
}

/** 題目卷各段的題號範圍；不是完整考卷就是空陣列 */
export function sectionRangesOf(paper: JsonObject): SectionRange[] {
  if (!Array.isArray(paper.sections)) return [];
  return paper.sections.flatMap((s) => {
    const o = s as Record<string, unknown>;
    const section = o.ielts_section;
    const first = o.first_question;
    const last = o.last_question;
    return typeof section === "number" &&
      typeof first === "number" &&
      typeof last === "number"
      ? [{ section, first, last }]
      : [];
  });
}

/** 一段的標題（考卷列表用來分辨不同的完整考卷） */
export type SectionTitle = { section: number; title: string };

/** 題目卷各段的標題（照段的順序）；不是完整考卷就是空陣列 */
export function sectionTitlesOf(paper: JsonObject): SectionTitle[] {
  if (!Array.isArray(paper.sections)) return [];
  return paper.sections
    .flatMap((s) => {
      const o = s as Record<string, unknown>;
      return typeof o.ielts_section === "number" && typeof o.title === "string"
        ? [{ section: o.ielts_section, title: o.title }]
        : [];
    })
    .sort((a, b) => a.section - b.section);
}

/** 題號 q31 → 31；認不得是 null */
export function questionNumberOf(questionId: string): number | null {
  const m = /^q(\d+)$/.exec(questionId);
  return m ? Number(m[1]) : null;
}

/** 一段的成績 */
export type SectionScore = { section: number; correct: number; total: number };

/** 每段答對幾題（照題號落在哪一段） */
export function sectionScores(
  ranges: readonly SectionRange[],
  results: readonly { questionId: string; correct: boolean }[],
): SectionScore[] {
  return ranges.map((r) => {
    const mine = results.filter((x) => {
      const n = questionNumberOf(x.questionId);
      return n !== null && n >= r.first && n <= r.last;
    });
    return {
      section: r.section,
      correct: mine.filter((x) => x.correct).length,
      total: mine.length,
    };
  });
}

/** 雅思聽力滿分的題數；滿 40 題才換算級分 */
export const IELTS_LISTENING_QUESTIONS = 40;

/**
 * 答對題數 → 雅思聽力級分（估算）。
 * 官方只公布幾個錨點（約 16 題＝5、23＝6、30＝7、35＝8），每次考試依難度微調；
 * 中間的半級分用常見的練習換算表。出處見 docs/282-…/designs/design-full-exam.md。
 */
const BAND_TABLE: readonly [minCorrect: number, band: number][] = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [32, 7.5],
  [30, 7],
  [26, 6.5],
  [23, 6],
  [18, 5.5],
  [16, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [2, 2],
  [1, 1],
  [0, 0],
];

/** 40 題的答對題數換算成級分；不是 40 題的考卷回傳 null */
export function estimatedBand(correct: number, total: number): number | null {
  if (total !== IELTS_LISTENING_QUESTIONS) return null;
  const hit = BAND_TABLE.find(([min]) => correct >= min);
  return hit ? hit[1] : 0;
}
