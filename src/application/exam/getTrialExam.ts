import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";

/** 免費試卷的考卷：目前公開的那張，沒有就是 null。 */
export class GetTrialExam {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(): Promise<{ setId: string } | null> {
    const set = await this.sets.findPublic();
    return set ? { setId: set.setId } : null;
  }
}
