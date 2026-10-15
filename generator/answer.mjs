import { normalize } from "./normalize.mjs";

const MONTHS = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};
const MONTH_RE = Object.keys(MONTHS).join("|");
const DATE_DM = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:\\s+(\\d{4}))?`, "gi");
const DATE_MD = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi");

const dashToSpace = (s) => normalize(s).replace(/-/g, " ").replace(/\s+/g, " ");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseDate(str) {
  const hits = findDates(String(str));
  if (hits.length !== 1) return null;
  const h = hits[0];
  return h.end - h.index >= String(str).trim().length - 1 ? h : null;
}

export function findDates(text) {
  const out = [];
  for (const m of text.matchAll(DATE_DM)) {
    out.push({ index: m.index, end: m.index + m[0].length, day: +m[1], month: MONTHS[m[2].toLowerCase()], year: m[3] ? +m[3] : null });
  }
  for (const m of text.matchAll(DATE_MD)) {
    out.push({ index: m.index, end: m.index + m[0].length, day: +m[2], month: MONTHS[m[1].toLowerCase()], year: m[3] ? +m[3] : null });
  }
  return out.sort((a, b) => a.index - b.index);
}

const sameDate = (a, b) => a.day === b.day && a.month === b.month && (a.year == null || b.year == null || a.year === b.year);

export function numberWordToDigits(token) {
  const t = normalize(token);
  if (/^\d+$/.test(t)) return String(+t);
  return t in NUMBER_WORDS ? String(NUMBER_WORDS[t]) : null;
}

// 出現在逐字稿中的拼字（H-A-R-L-O-W），回傳 [{index, letters}]
export function findSpelled(text) {
  const out = [];
  for (const m of text.matchAll(/\b(?:[A-Za-z]-){2,}[A-Za-z]\b/g)) {
    out.push({ index: m.index, end: m.index + m[0].length, letters: m[0].replace(/-/g, "").toLowerCase() });
  }
  return out;
}

const candidates = (entry) => [entry.answer, ...(entry.accepted ?? [])];

// 評分：使用者填的字是否等於標準答案（或可接受寫法）
export function matchesAnswer(policy, given, entry) {
  const g = normalize(given);
  if (!g) return false;
  switch (policy) {
    case "exact_word":
      return candidates(entry).some((c) => dashToSpace(c) === dashToSpace(given));
    case "date_equivalence": {
      const gd = parseDate(given);
      if (!gd) return false;
      return candidates(entry).some((c) => { const cd = parseDate(c); return cd && sameDate(cd, gd); });
    }
    case "digits_only": {
      if (/[a-z]/i.test(g)) return false;
      const gd = g.replace(/[\s-]/g, "");
      return candidates(entry).some((c) => c.replace(/[\s-]/g, "") === gd);
    }
    case "number_word": {
      const gn = numberWordToDigits(given);
      return gn !== null && candidates(entry).some((c) => numberWordToDigits(c) === gn);
    }
    default:
      throw new Error(`unknown answer_policy: ${policy}`);
  }
}

// 驗證：答案是否出現在一段逐字稿裡。回傳第一個命中的 {index, end}，沒有則 null。
export function findInText(policy, entry, text) {
  const hits = [];
  switch (policy) {
    case "exact_word": {
      const hay = text.toLowerCase().replace(/-/g, " ");
      for (const c of candidates(entry)) {
        const needle = dashToSpace(c);
        if (!needle) continue;
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(needle).replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "giu");
        for (const m of hay.matchAll(re)) hits.push({ index: m.index, end: m.index + m[0].length });
        const letters = needle.replace(/[^a-z]/g, "");
        const words = needle.split(" ").map((w) => w.replace(/[^a-z]/g, ""));
        for (const sp of findSpelled(text)) {
          if (sp.letters === letters || words.includes(sp.letters)) hits.push({ index: sp.index, end: sp.end });
        }
      }
      break;
    }
    case "date_equivalence": {
      const targets = candidates(entry).map(parseDate).filter(Boolean);
      for (const d of findDates(text)) if (targets.some((t) => sameDate(t, d))) hits.push({ index: d.index, end: d.end });
      break;
    }
    case "digits_only": {
      const targets = candidates(entry).map((c) => c.replace(/[\s-]/g, ""));
      for (const m of text.matchAll(/\d(?:[\d\s-]*\d)?/g)) {
        if (targets.includes(m[0].replace(/[\s-]/g, ""))) hits.push({ index: m.index, end: m.index + m[0].length });
      }
      break;
    }
    case "number_word": {
      const targets = candidates(entry).map(numberWordToDigits).filter((x) => x !== null);
      const re = new RegExp(`\\b(\\d+|${Object.keys(NUMBER_WORDS).join("|")})\\b`, "gi");
      for (const m of text.matchAll(re)) {
        if (targets.includes(numberWordToDigits(m[0]))) hits.push({ index: m.index, end: m.index + m[0].length });
      }
      break;
    }
    default:
      throw new Error(`unknown answer_policy: ${policy}`);
  }
  if (!hits.length) return null;
  return hits.sort((a, b) => a.index - b.index)[0];
}
