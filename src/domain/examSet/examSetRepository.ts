import type { ExamAccess, ExamSet, ExamSetPrivate } from "./examSet";
import type { ExamSetFilter, ExamSetSummary } from "./examSetFilter";
import type { ReviewRecord, TeacherReview } from "./review";

/** 題組儲存的 port。 */
export interface ExamSetRepository {
  exists(setId: string): Promise<boolean>;
  /** 公開部分與私密部分一起存 */
  save(set: ExamSet, secret: ExamSetPrivate): Promise<void>;
  /** 新上傳的在前面 */
  list(): Promise<ExamSet[]>;
  /** 後台清單用：只帶清單欄位、照條件過濾，新上傳的在前面 */
  listSummaries(filter: ExamSetFilter): Promise<ExamSetSummary[]>;
  findById(setId: string): Promise<ExamSet | null>;
  findPrivate(setId: string): Promise<ExamSetPrivate | null>;
  findReview(setId: string): Promise<TeacherReview | null>;
  /** 存審稿、記一筆審稿紀錄，並同步更新題組狀態（同一個交易） */
  saveReview(review: TeacherReview): Promise<void>;
  setAccess(setId: string, access: ExamAccess): Promise<void>;
  /** 某位老師從 since 之後審了幾套（依審稿紀錄；同一套審好幾次只算一套） */
  /** 刪掉題組（連同私密部分與審稿） */
  delete(setId: string): Promise<void>;
  countReviewsBy(reviewerId: string, since: Date): Promise<number>;
  /** [from, to) 之間的審稿紀錄，新的在前 */
  listReviewRecords(from: Date, to: Date): Promise<ReviewRecord[]>;
}
