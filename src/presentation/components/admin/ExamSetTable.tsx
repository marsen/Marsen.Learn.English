import type { ExamAccess, ExamSet } from "@/domain/examSet/examSet";
import {
  AI_VERDICT_LABELS,
  ACCESS_LABELS,
  STATUS_LABELS,
} from "@/presentation/lib/examSetLabels";

type Props = {
  sets: ExamSet[];
  /** 有「設定考卷開放對象」權限才給，沒給就只顯示不能改 */
  setAccessAction?: (formData: FormData) => Promise<void>;
};

const other = (a: ExamAccess): ExamAccess => (a === "public" ? "members" : "public");

export function ExamSetTable({ sets, setAccessAction }: Props) {
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
            <th className="px-4 py-3 font-medium">開放對象</th>
            <th className="px-4 py-3 font-medium">上傳時間</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.setId} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-mono">
                <a href={`/admin/sets/${s.setId}`} className="text-primary underline">
                  {s.setId}
                </a>
              </td>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3">{s.questionCount}</td>
              <td className="px-4 py-3">{AI_VERDICT_LABELS[s.aiVerdict]}</td>
              <td className="px-4 py-3">{STATUS_LABELS[s.status]}</td>
              <td className="px-4 py-3">
                {ACCESS_LABELS[s.access]}
                {setAccessAction && (
                  <form action={setAccessAction} className="inline">
                    <input type="hidden" name="setId" value={s.setId} />
                    <input type="hidden" name="access" value={other(s.access)} />
                    <button type="submit" className="ml-2 text-xs text-primary underline">
                      改成{ACCESS_LABELS[other(s.access)]}
                    </button>
                  </form>
                )}
              </td>
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
