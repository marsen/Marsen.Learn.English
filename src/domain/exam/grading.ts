/**
 * 批改規則（由舊版 legacy/lib/answer.mjs、normalize.mjs、grade.mjs 改寫）。
 * 每一題照出題工具給的「答案規則」（answer_policy）比對，標準答案或任一個可接受寫法對上就算對。
 */
export const ANSWER_POLICIES = [
  "exact_word",
  "date_equivalence",
  "digits_only",
  "number_word",
] as const;

export type AnswerPolicy = (typeof ANSWER_POLICIES)[number];

export function isAnswerPolicy(v: unknown): v is AnswerPolicy {
  return (ANSWER_POLICIES as readonly unknown[]).includes(v);
}

/** 一題的標準答案 */
export type AnswerKeyEntry = {
  questionId: string;
  answer: string;
  accepted: string[];
  policy: AnswerPolicy;
};

/** 字串層級的正規化：撇號統一、小寫、壓空白、去掉結尾標點。其他規則交給 answer_policy */
export function normalize(input: string): string {
  return input
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const MONTH_RE = Object.keys(MONTHS).join("|");
const DATE_DM = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:\\s+(\\d{4}))?`,
  "gi",
);
const DATE_MD = new RegExp(
  `\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`,
  "gi",
);

type DateHit = {
  index: number;
  end: number;
  day: number;
  month: number;
  year: number | null;
};

function findDates(text: string): DateHit[] {
  const out: DateHit[] = [];
  for (const m of text.matchAll(DATE_DM)) {
    const index = m.index ?? 0;
    out.push({
      index,
      end: index + m[0].length,
      day: +m[1],
      month: MONTHS[m[2].toLowerCase()],
      year: m[3] ? +m[3] : null,
    });
  }
  for (const m of text.matchAll(DATE_MD)) {
    const index = m.index ?? 0;
    out.push({
      index,
      end: index + m[0].length,
      day: +m[2],
      month: MONTHS[m[1].toLowerCase()],
      year: m[3] ? +m[3] : null,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** 整個字串剛好是一個日期才算（「14 March」可以，「March」或兩個日期都不行） */
export function parseDate(str: string): DateHit | null {
  const hits = findDates(str);
  if (hits.length !== 1) return null;
  const h = hits[0];
  return h.end - h.index >= str.trim().length - 1 ? h : null;
}

const sameDate = (a: DateHit, b: DateHit) =>
  a.day === b.day &&
  a.month === b.month &&
  (a.year === null || b.year === null || a.year === b.year);

/** "3"、"three" → "3"；只處理 0 到 20 的英文數字 */
export function numberWordToDigits(token: string): string | null {
  const t = normalize(token);
  if (/^\d+$/.test(t)) return String(+t);
  return t in NUMBER_WORDS ? String(NUMBER_WORDS[t]) : null;
}

const dashToSpace = (s: string) => normalize(s).replace(/-/g, " ").replace(/\s+/g, " ");

/** 考生寫的答案對不對 */
export function matchesAnswer(
  entry: Omit<AnswerKeyEntry, "questionId">,
  given: string,
): boolean {
  const g = normalize(given);
  if (!g) return false;
  const candidates = [entry.answer, ...entry.accepted];
  switch (entry.policy) {
    case "exact_word":
      // 連字號等同空白（King-Street = King Street），拼錯就是錯
      return candidates.some((c) => dashToSpace(c) === dashToSpace(given));
    case "date_equivalence": {
      const gd = parseDate(given);
      if (!gd) return false;
      return candidates.some((c) => {
        const cd = parseDate(c);
        return cd !== null && sameDate(cd, gd);
      });
    }
    case "digits_only": {
      // 去掉空白與連字號；有字母就錯
      if (/[a-z]/i.test(g)) return false;
      const gd = g.replace(/[\s-]/g, "");
      return candidates.some((c) => c.replace(/[\s-]/g, "") === gd);
    }
    case "number_word": {
      const gn = numberWordToDigits(given);
      return gn !== null && candidates.some((c) => numberWordToDigits(c) === gn);
    }
  }
}

/** 一題的批改結果 */
export type QuestionResult = {
  questionId: string;
  /** 題號（照題目卷由上到下 1, 2, 3…） */
  number: number;
  given: string;
  expected: string;
  accepted: string[];
  correct: boolean;
};

export type GradeResult = { score: number; total: number; results: QuestionResult[] };

/** 批改整張考卷 */
export function grade(
  key: readonly AnswerKeyEntry[],
  answers: Record<string, string>,
): GradeResult {
  const results = key.map((e, i) => {
    const given = answers[e.questionId] ?? "";
    return {
      questionId: e.questionId,
      number: i + 1,
      given,
      expected: e.answer,
      accepted: e.accepted,
      correct: matchesAnswer(e, given),
    };
  });
  return {
    score: results.filter((r) => r.correct).length,
    total: results.length,
    results,
  };
}
