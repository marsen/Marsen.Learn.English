import type { AvailableExam } from "@/application/exam/examResult";
import { EmptyState } from "@/presentation/components/ui/EmptyState";

export function ExamList({ exams }: { exams: AvailableExam[] }) {
  if (exams.length === 0) return <EmptyState>目前沒有可以寫的考卷。</EmptyState>;
  return (
    <ul className="grid gap-3">
      {exams.map((e) => (
        <li key={e.setId}>
          <a
            href={`/exam/${e.setId}`}
            className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3"
          >
            <span>
              {e.title}
              <span className="ml-2 text-sm text-muted-foreground">
                {e.questionCount} 題
              </span>
            </span>
            {e.access === "public" && (
              <span className="rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
                公開
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
