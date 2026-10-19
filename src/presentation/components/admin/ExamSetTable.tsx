import type { ExamSet } from "@/domain/examSet/examSet";
import { AI_VERDICT_LABELS, STATUS_LABELS } from "@/presentation/lib/examSetLabels";

export function ExamSetTable({ sets }: { sets: ExamSet[] }) {
  if (sets.length === 0) return <p className="text-muted-foreground">還沒有題組。</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">題組</th>
            <th className="px-4 py-3 font-medium">標題</th>
            <th className="px-4 py-3 font-medium">題數</th>
            <th className="px-4 py-3 font-medium">AI 審稿</th>
            <th className="px-4 py-3 font-medium">狀態</th>
            <th className="px-4 py-3 font-medium">上傳時間</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.setId} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-mono">{s.setId}</td>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3">{s.questionCount}</td>
              <td className="px-4 py-3">{AI_VERDICT_LABELS[s.aiVerdict]}</td>
              <td className="px-4 py-3">{STATUS_LABELS[s.status]}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.uploadedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
