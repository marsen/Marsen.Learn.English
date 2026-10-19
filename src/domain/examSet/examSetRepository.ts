import type { ExamSet, ExamSetPrivate } from "./examSet";

/** 題組儲存的 port。 */
export interface ExamSetRepository {
  exists(setId: string): Promise<boolean>;
  /** 公開部分與私密部分一起存 */
  save(set: ExamSet, secret: ExamSetPrivate): Promise<void>;
  /** 新上傳的在前面 */
  list(): Promise<ExamSet[]>;
}
