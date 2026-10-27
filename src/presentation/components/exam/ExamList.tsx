"use client";

import { useTranslations } from "next-intl";
import type { AvailableExam } from "@/application/exam/examResult";
import { EmptyState } from "@/presentation/components/ui/EmptyState";

export function ExamList({ exams }: { exams: AvailableExam[] }) {
  const t = useTranslations();
  if (exams.length === 0) return <EmptyState>{t("examList.empty")}</EmptyState>;
  return (
    <ul className="grid gap-3">
      {exams.map((e) => (
        <li key={e.setId}>
          <a
            href={`/exam/${e.setId}`}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
          >
            <span>
              {e.title}
              <span className="ml-2 text-sm text-muted-foreground">
                {t("examList.questionCount", { count: e.questionCount })}
              </span>
            </span>
            {e.access === "public" && (
              <span className="rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {t("examSet.access.public")}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
