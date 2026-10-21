import type { ExamAccess, ExamSet, ExamSetPrivate } from "./examSet";
import type { TeacherReview } from "./review";

/** 題組儲存的 port。 */
export interface ExamSetRepository {
  exists(setId: string): Promise<boolean>;
  /** 公開部分與私密部分一起存 */
  save(set: ExamSet, secret: ExamSetPrivate): Promise<void>;
  /** 新上傳的在前面 */
  list(): Promise<ExamSet[]>;
  findById(setId: string): Promise<ExamSet | null>;
  findPrivate(setId: string): Promise<ExamSetPrivate | null>;
  findReview(setId: string): Promise<TeacherReview | null>;
  /** 存審稿並同步更新題組狀態（同一個交易） */
  saveReview(review: TeacherReview): Promise<void>;
  setAccess(setId: string, access: ExamAccess): Promise<void>;
  /** 某位老師從 since 之後審了幾套（每套只算最新一次審稿） */
  countReviewsBy(reviewerId: string, since: Date): Promise<number>;
}
