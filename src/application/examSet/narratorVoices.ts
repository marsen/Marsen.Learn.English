import type { ExamSetPrivate } from "@/domain/examSet/examSet";

/** 錄音裡的一位旁白用了什麼聲音；沒記錄的欄位是 null */
export type Narrator = {
  /** 旁白代號：A、B… */
  role: string;
  engine: string | null;
  /** 聲音代號（出題工具 cast 的 id），例如 bm_fable、breeze-us-f-middle-1 */
  voice: string | null;
  accent: string | null;
  /** 出題工具的值：m／f */
  gender: string | null;
  /** 出題工具的值：young／middle／old */
  age: string | null;
};

/** 一段錄音的旁白；完整考卷每段一筆，2.x 只有一筆（ieltsSection 是 null） */
export type SectionVoices = {
  ieltsSection: number | null;
  /** 沒記錄旁白時是空陣列 */
  narrators: Narrator[];
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** 出題工具的 cast：{ A: {...}, B: {...}, speller } → 旁白清單（只認單一大寫字母的鍵） */
function narratorsOf(cast: unknown): Narrator[] {
  if (!isObj(cast)) return [];
  return Object.keys(cast)
    .filter((k) => /^[A-Z]$/.test(k) && isObj(cast[k]))
    .sort()
    .map((role) => {
      const v = cast[role] as Obj;
      return {
        role,
        engine: text(v.engine),
        voice: text(v.id),
        accent: text(v.accent),
        gender: text(v.gender),
        age: text(v.age),
      };
    });
}

/**
 * 題組錄音的旁白（審稿頁給管理員看）。只讀已存的資料：
 * - 2.x：答案卡的 cast
 * - 完整考卷：製作紀錄每段的 cast（上傳時從 sections[i].answers.cast 搬過來；更早上傳的沒有）
 */
export function narratorVoicesOf(
  secret: Pick<ExamSetPrivate, "answers" | "provenance">,
  fullExam: boolean,
): SectionVoices[] {
  if (!fullExam)
    return [{ ieltsSection: null, narrators: narratorsOf(secret.answers.cast) }];
  const sections = Array.isArray(secret.provenance.sections)
    ? secret.provenance.sections.filter(isObj)
    : [];
  return sections
    .filter((s) => typeof s.ielts_section === "number")
    .map((s) => ({
      ieltsSection: s.ielts_section as number,
      narrators: narratorsOf(s.cast),
    }))
    .sort((a, b) => a.ieltsSection - b.ieltsSection);
}
