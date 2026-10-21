import Link from "next/link";
import type { TeacherDashboardView } from "@/application/dashboard/teacherDashboard";
import { StatusTags } from "@/presentation/components/admin/StatusTags";
import { waitedLabel } from "@/presentation/lib/waiting";

/** 老師總覽：還沒審的題組（別的老師審完就會消失）、這個月審了幾套。 */
export function TeacherDashboard({
  view,
  now,
}: {
  view: TeacherDashboardView;
  now: Date;
}) {
  const oldest = view.pending[0];

  return (
    <section>
      <p className="text-sm text-muted-foreground">
        別的老師審完的題組會自動從清單消失，不會重複審。
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/40 bg-primary-soft/40 p-5 sm:col-span-2">
          <p className="text-sm text-primary-hover">等你審的題組</p>
          <p className="mt-1 text-5xl font-bold text-heading">
            {view.pending.length} <span className="text-lg font-medium">套</span>
          </p>
          {oldest && (
            <p className="mt-2 text-sm text-primary-hover">
              {waitedLabel(oldest.uploadedAt, now) === "今天"
                ? "最舊的是今天上傳的"
                : `最久的已經等了 ${waitedLabel(oldest.uploadedAt, now)}`}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">你這個月審了</p>
          <p className="mt-1 text-4xl font-bold">
            {view.reviewedThisMonth} <span className="text-base font-medium">套</span>
          </p>
        </div>
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold text-heading">
        待審清單（最舊的在上面）
      </h2>
      {view.pending.length === 0 ? (
        <p className="rounded-2xl border border-border bg-white px-5 py-8 text-center text-muted-foreground">
          目前沒有要審的題組，辛苦了。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">題組</th>
                <th className="px-4 py-3 font-medium">標題</th>
                <th className="px-4 py-3 font-medium">AI 怎麼說</th>
                <th className="px-4 py-3 font-medium">等了</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {view.pending.map((s) => (
                <tr key={s.setId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono whitespace-nowrap text-primary">
                    {s.setId}
                  </td>
                  <td className="px-4 py-3">{s.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusTags tags={[s.aiVerdict === "pass" ? "AIP" : "AI_WARN"]} />
                    {s.aiVerdict !== "pass" && s.findingCount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.findingCount} 個疑點
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {waitedLabel(s.uploadedAt, now)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/sets/${s.setId}`}
                      className="inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-medium whitespace-nowrap text-primary-foreground hover:bg-primary-hover"
                    >
                      開始審稿
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
