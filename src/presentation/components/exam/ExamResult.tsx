import type { AttemptResultView } from "@/application/exam/examResult";

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
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">題號</th>
              <th className="px-4 py-3 font-medium">你寫的</th>
              {result.answerKeyVisible && <th className="px-4 py-3 font-medium">正解</th>}
            </tr>
          </thead>
          <tbody>
            {result.results.map((r) => (
              <tr
                key={r.questionId}
                className={`border-b border-border last:border-0 ${r.correct ? "" : "bg-destructive/5"}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.number} {r.correct ? "✓" : "✗"}
                </td>
                <td className={`px-4 py-3 ${r.given ? "" : "text-muted-foreground"}`}>
                  {r.given || "（空白）"}
                </td>
                {result.answerKeyVisible && (
                  <td className="px-4 py-3">
                    {r.expected}
                    {r.accepted.length > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        （也算對：{r.accepted.join("、")}）
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
