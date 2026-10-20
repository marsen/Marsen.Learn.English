import type { AttemptRecord } from "@/application/exam/examResult";

/** 我的考試紀錄：日期、考卷、分數，點進去看完整結果。 */
export function AttemptHistory({ records }: { records: AttemptRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-muted-foreground">
        還沒有紀錄。
        <a href="/exam" className="text-primary underline">
          去寫一張考卷
        </a>
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">交卷時間</th>
            <th className="px-4 py-3 font-medium">考卷</th>
            <th className="px-4 py-3 font-medium">分數</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.attemptId} className="border-b border-border last:border-0">
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {r.submittedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
              </td>
              <td className="px-4 py-3">{r.title}</td>
              <td className="px-4 py-3 font-medium">
                {r.score} / {r.total}
              </td>
              <td className="px-4 py-3">
                <a
                  href={`/exam/result/${r.attemptId}`}
                  className="text-primary underline"
                >
                  看結果
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
