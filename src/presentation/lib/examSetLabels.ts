import type { AiVerdict, ExamAccess, ExamSetStatus } from "@/domain/examSet/examSet";

/** 給老師看的說法（不用技術用語）。沒列到的值就照原樣顯示。 */
export const AI_VERDICT_LABELS: Record<AiVerdict, string> = {
  pass: "AI 審稿通過",
  needs_human: "AI 有疑慮，需要老師看",
};

export const STATUS_LABELS: Record<ExamSetStatus, string> = {
  pending_review: "待老師審稿",
  approved: "合格",
  rejected: "不合格",
};

export const ACCESS_LABELS: Record<ExamAccess, string> = {
  public: "公開（路人也能寫）",
  members: "會員",
};

const TRAP_LABELS: Record<string, string> = {
  none: "無",
  similar_numbers: "相近數字（例如 15／50）",
  spelling: "拼字（錄音逐字母唸）",
  distractor: "干擾資訊（有提到但不是答案）",
  paraphrase: "換句話說（錄音和題目用不同說法）",
  self_correction: "說錯再更正",
};

const ANSWER_POLICY_LABELS: Record<string, string> = {
  exact_word: "照錄音裡的字",
  digits_only: "只寫數字",
  number_word: "數字或英文數字都算對",
  date_equivalence: "日期寫法不拘",
};

const ANSWER_TYPE_LABELS: Record<string, string> = {
  word: "單字",
  name_spelled: "拼出的名字",
  phone: "電話號碼",
  number: "數字",
  place: "地點",
};

const AI_RULING_LABELS: Record<string, string> = {
  problem: "AI 判定：有問題",
  ok: "AI 判定：沒問題",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "提醒",
  warn: "注意",
  block: "嚴重",
};

const CATEGORY_LABELS: Record<string, string> = {
  ambiguity: "答案不夠明確",
  evidence: "錄音裡找不到依據",
  trap: "干擾陷阱",
  naturalness: "對話不自然",
  consistency: "前後不一致",
  difficulty: "難度",
  other: "其他",
};

const lookup = (table: Record<string, string>) => (v: string | null) =>
  v === null ? "—" : (table[v] ?? v);

export const trapLabel = lookup(TRAP_LABELS);
export const answerPolicyLabel = lookup(ANSWER_POLICY_LABELS);
export const answerTypeLabel = lookup(ANSWER_TYPE_LABELS);
export const aiRulingLabel = lookup(AI_RULING_LABELS);
export const severityLabel = lookup(SEVERITY_LABELS);
export const categoryLabel = lookup(CATEGORY_LABELS);
