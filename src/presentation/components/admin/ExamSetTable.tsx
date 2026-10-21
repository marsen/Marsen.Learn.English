import type { ExamAccess, ExamSet } from "@/domain/examSet/examSet";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { ACCESS_HINTS, ACCESS_LABELS } from "@/presentation/lib/examSetLabels";
import { StatusTags } from "./StatusTags";

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
            <th className="px-4 py-3 font-medium">狀態</th>
            <th className="px-4 py-3 font-medium">開放對象</th>
            <th className="px-4 py-3 font-medium">上傳時間</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.setId} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-mono whitespace-nowrap">
                <a href={`/admin/sets/${s.setId}`} className="text-primary underline">
                  {s.setId}
                </a>
              </td>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3 whitespace-nowrap">{s.questionCount}</td>
              <td className="px-4 py-3">
                <StatusTags tags={statusTagsOf(s)} />
              </td>
              <td className="px-4 py-3">
                <span className="whitespace-nowrap" title={ACCESS_HINTS[s.access]}>
                  {ACCESS_LABELS[s.access]}
                </span>
                {setAccessAction && (
                  <form action={setAccessAction} className="block">
                    <input type="hidden" name="setId" value={s.setId} />
                    <input type="hidden" name="access" value={other(s.access)} />
                    <button
                      type="submit"
                      className="text-xs whitespace-nowrap text-primary underline"
                    >
                      改成{ACCESS_LABELS[other(s.access)]}
                    </button>
                  </form>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {s.uploadedAt.toLocaleString("zh-TW", {
                  timeZone: "Asia/Taipei",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
