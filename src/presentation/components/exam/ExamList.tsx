"use client";

import { useTranslations } from "next-intl";
import type { AvailableExam } from "@/application/exam/examResult";
import { EmptyState } from "@/presentation/components/ui/EmptyState";

/**
 * 考卷列表。完整考卷寫「完整考卷（4 段・40 題）」，下一行列各段標題，不同套看得出不一樣；
 * 單段考卷才寫 Section 1。
 */
export function ExamList({ exams }: { exams: AvailableExam[] }) {
  const t = useTranslations();
  if (exams.length === 0) return <EmptyState>{t("examList.empty")}</EmptyState>;
  return (
    <ul className="grid gap-3">
      {exams.map((e) => (
        <li key={e.setId}>
          <a
            href={`/exam/${e.setId}`}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block">
                {e.title}
                <span className="ml-2 text-sm text-muted-foreground">
                  {e.sections.length > 0
                    ? t("examList.fullExam", {
                        sections: e.sections.length,
                        count: e.questionCount,
                      })
                    : t("examList.singleSection", { count: e.questionCount })}
                </span>
              </span>
              {e.sections.length > 0 && (
                <span className="mt-1 block text-sm break-words text-muted-foreground">
                  {e.sections
                    .map((s) =>
                      t("examList.sectionTitle", { n: s.section, title: s.title }),
                    )
                    .join("・")}
                </span>
              )}
            </span>
            {e.access === "public" && (
              <span className="shrink-0 rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {t("examSet.access.public")}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
