import { canTake } from "@/domain/examSet/access";
import type { ExamSetRepository } from "@/domain/examSet/examSetRepository";
import { rolesOf, type Actor } from "@/application/shared/actor";
import type { AvailableExam } from "./examResult";

/** 這個人現在能寫的考卷（路人只看得到公開的）。 */
export class ListAvailableExams {
  constructor(private readonly sets: ExamSetRepository) {}

  async execute(input: { actor: Actor }): Promise<AvailableExam[]> {
    const roles = rolesOf(input.actor);
    return (await this.sets.list())
      .filter((s) => canTake(roles, s))
      .map((s) => ({
        setId: s.setId,
        title: s.title,
        questionCount: s.questionCount,
        access: s.access,
      }));
  }
}
