"use client";

import { useTranslations } from "next-intl";
import type { AttemptResultView } from "@/application/exam/examResult";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";

/** 批改結果：分數、每題你寫的與正解。 */
export function ExamResult({ result }: { result: AttemptResultView }) {
  const t = useTranslations();
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{result.title}</p>
        <p className="mt-1 text-3xl font-semibold">
          {result.score} / {result.total}
        </p>
      </div>
      <Table
        head={
          <>
            <Th>{t("result.colNumber")}</Th>
            <Th>{t("result.colGiven")}</Th>
            {result.answerKeyVisible && <Th>{t("result.colExpected")}</Th>}
          </>
        }
      >
        {result.results.map((r) => (
          <Tr key={r.questionId} className={r.correct ? undefined : "bg-destructive/5"}>
            <Td className="whitespace-nowrap">
              {r.number} {r.correct ? "✓" : "✗"}
            </Td>
            <Td className={r.given ? undefined : "text-muted-foreground"}>
              {r.given || t("result.blank")}
            </Td>
            {result.answerKeyVisible && (
              <Td>
                {r.expected}
                {r.accepted.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    {t("result.accepted", {
                      list: r.accepted.join(t("common.listSeparator")),
                    })}
                  </span>
                )}
              </Td>
            )}
          </Tr>
        ))}
      </Table>
    </div>
  );
}
