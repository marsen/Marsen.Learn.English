import type { AttemptResultView } from "@/application/exam/examResult";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";

/** 批改結果：分數、每題你寫的與正解。 */
export function ExamResult({ result }: { result: AttemptResultView }) {
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
            <Th>題號</Th>
            <Th>你寫的</Th>
            {result.answerKeyVisible && <Th>正解</Th>}
          </>
        }
      >
        {result.results.map((r) => (
          <Tr key={r.questionId} className={r.correct ? undefined : "bg-destructive/5"}>
            <Td className="whitespace-nowrap">
              {r.number} {r.correct ? "✓" : "✗"}
            </Td>
            <Td className={r.given ? undefined : "text-muted-foreground"}>
              {r.given || "（空白）"}
            </Td>
            {result.answerKeyVisible && (
              <Td>
                {r.expected}
                {r.accepted.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    （也算對：{r.accepted.join("、")}）
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
