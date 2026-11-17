import type { ExamAccess, PublicTiming } from "@/domain/examSet/examSet";
import type { GradeResult } from "@/domain/exam/grading";
import type { SectionScore } from "@/domain/examSet/fullExam";
import type { FullPaperView, PaperView } from "./paperView";

/** 考卷清單上的一張 */
export type AvailableExam = {
  setId: string;
  title: string;
  questionCount: number;
  access: ExamAccess;
};

/** 開始考試後給考生的內容：題目卷、時間軸。不含答案、不含逐字稿 */
export type ExamSheet = {
  attemptId: string;
  setId: string;
  title: string;
  paper: PaperView;
  /** 完整考卷（四個 section）才有；有的話畫面照這個畫，paper 是空的 */
  fullPaper: FullPaperView | null;
  timing: PublicTiming;
};

export type StartExamResult =
  { ok: true; sheet: ExamSheet } | { ok: false; reason: "not_available" };

export type SubmitExamResult =
  | { ok: true; attemptId: string }
  | { ok: false; reason: "not_found" | "already_submitted" };

/** 結果頁的一題。沒有「看正解」權限時 expected 為 null、accepted 為空（正解根本不會送出伺服器） */
export type QuestionResultView = Omit<GradeResult["results"][number], "expected"> & {
  expected: string | null;
};

/** 結果頁：分數與每題對錯；有權限才附正解 */
export type AttemptResultView = {
  attemptId: string;
  setId: string;
  title: string;
  submittedAt: Date;
  score: number;
  total: number;
  answerKeyVisible: boolean;
  results: QuestionResultView[];
  /** 完整考卷才有：每個 section 對幾題；2.x 是空陣列 */
  sections: SectionScore[];
  /** 滿分 40 題的完整考卷才有：換算的雅思級分（估算）；其他是 null */
  band: number | null;
};

/** 考試紀錄的一筆 */
export type AttemptRecord = {
  attemptId: string;
  setId: string;
  title: string;
  submittedAt: Date;
  score: number;
  total: number;
};
