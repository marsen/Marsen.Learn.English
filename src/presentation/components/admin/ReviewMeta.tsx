"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatFullDateTime } from "@/presentation/lib/format";
import { FullExamBadge } from "./FullExamBadge";

/** 審稿頁標題下面那一行：題組編號 · 幾題 · 上次審稿時間 */
export function ReviewMeta({
  setId,
  questionCount,
  reviewedAt,
  fullExam = false,
}: {
  setId: string;
  /** 完整考卷：代號旁加「完整考卷」標籤 */
  fullExam?: boolean;
  questionCount: number;
  reviewedAt: Date | null;
}) {
  const t = useTranslations("review");
  const locale = useLocale();
  return (
    <>
      <span className="font-mono">{setId}</span>
      {fullExam && <FullExamBadge />} · {t("questionCount", { count: questionCount })}
      {reviewedAt &&
        ` · ${t("lastReviewed", { time: formatFullDateTime(reviewedAt, locale) })}`}
    </>
  );
}
