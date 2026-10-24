/**
 * 題組（純資料）。來源是 Question.Generator 打包出的 set.json + audio.mp3。
 *
 * 一套題拆成兩半存：
 * - ExamSet：考生看得到的部分（題目卷、時間軸），不含答案、不含逐字稿
 * - ExamSetPrivate：標準答案與製作紀錄，只有老師／伺服器讀得到
 */

/** AI 審稿結論：pass＝通過；needs_human＝有疑慮，要老師看 */
export type AiVerdict = "pass" | "needs_human";

/** 題組狀態：待老師審稿 → 合格／不合格（老師可以改判，以最後一次為準） */
export const EXAM_SET_STATUSES = ["pending_review", "approved", "rejected"] as const;

export type ExamSetStatus = (typeof EXAM_SET_STATUSES)[number];

export function isExamSetStatus(v: string): v is ExamSetStatus {
  return (EXAM_SET_STATUSES as readonly string[]).includes(v);
}

/**
 * 考卷開放對象：public＝路人也能寫；members＝要登入的會員（學生、老師）才能寫。
 * 新上傳的預設是 members，由管理員改成 public。
 */
/** public：誰都能試考（沒登入也行）；members：上架給會員；unlisted：下架，誰都不能考 */
export const EXAM_ACCESSES = ["public", "members", "unlisted"] as const;

export type ExamAccess = (typeof EXAM_ACCESSES)[number];

export function isExamAccess(v: unknown): v is ExamAccess {
  return (EXAM_ACCESSES as readonly unknown[]).includes(v);
}

/** set.json 裡原樣保存、這一層不解讀的 JSON（題目卷、答案卡等） */
export type JsonObject = { [key: string]: unknown };

export type TimingEvent = {
  type: string;
  id?: string;
  start?: number;
  end?: number;
  questions?: unknown;
  seconds?: number;
  group?: unknown;
};

/** 給考生的時間軸：只留播放需要的欄位，不帶逐字稿文字與說話者 */
export type PublicTiming = {
  totalSeconds: number;
  events: TimingEvent[];
};

export type ExamSet = {
  setId: string;
  title: string;
  topic: string;
  questionCount: number;
  paper: JsonObject;
  timing: PublicTiming;
  audioKey: string;
  aiVerdict: AiVerdict;
  status: ExamSetStatus;
  access: ExamAccess;
  uploadedBy: string;
  uploadedAt: Date;
};

/** 逐字稿的一句。id 對得上時間軸裡 type=turn 的事件（例如 t12） */
export type TranscriptTurn = { id: string; speaker: string; text: string };

/** 某一題的答案出自哪一句 */
export type AnswerEvidence = { questionId: string; turn: string; quote: string };

/** 逐字稿與每題答案的出處（set.json 2.1 起才有）。含答案線索，只給老師、管理員看 */
export type Transcript = { turns: TranscriptTurn[]; evidence: AnswerEvidence[] };

export type ExamSetPrivate = {
  setId: string;
  /** 標準答案卡（set.json 的 answers） */
  answers: JsonObject;
  /** 製作紀錄（含 AI 示警，可能提到答案） */
  provenance: JsonObject;
  /** 逐字稿與答案出處；2.1 以前打包的題組沒有，是 null */
  transcript: Transcript | null;
};
