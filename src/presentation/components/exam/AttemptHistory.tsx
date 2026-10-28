"use client";

import { useTranslations } from "next-intl";
import type { AttemptRecord } from "@/application/exam/examResult";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { formatFullDateTime } from "@/presentation/lib/format";

/** 我的考試紀錄：日期、考卷、分數，點進去看完整結果。 */
export function AttemptHistory({ records }: { records: AttemptRecord[] }) {
  const t = useTranslations("history");
  if (records.length === 0) {
    return (
      <EmptyState>
        {t.rich("empty", {
          link: (chunks) => (
            <a href="/exam" className="text-primary underline">
              {chunks}
            </a>
          ),
        })}
      </EmptyState>
    );
  }
  return (
    <Table
      head={
        <>
          <Th>{t("colSubmitted")}</Th>
          <Th>{t("colExam")}</Th>
          <Th>{t("colScore")}</Th>
          <Th />
        </>
      }
    >
      {records.map((r) => (
        <Tr key={r.attemptId}>
          <Td className="whitespace-nowrap text-muted-foreground">
            {formatFullDateTime(r.submittedAt)}
          </Td>
          <Td>{r.title}</Td>
          <Td className="font-medium">
            {r.score} / {r.total}
          </Td>
          <Td>
            <a href={`/exam/result/${r.attemptId}`} className="text-primary underline">
              {t("view")}
            </a>
          </Td>
        </Tr>
      ))}
    </Table>
  );
}
