import Link from "next/link";
import type { ReviewLogView } from "@/application/dashboard/reviewLog";
import { StatusTags } from "./StatusTags";

const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${y} 年 ${Number(mm)} 月`;
};

const time = (d: Date) =>
  d.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** 審稿紀錄：每位老師這個月審了幾套，以及每一筆審稿。 */
export function ReviewLog({ view }: { view: ReviewLogView }) {
  return (
    <div className="grid gap-10">
      <nav className="flex items-center gap-3" aria-label="切換月份">
        <Link href={`/admin/reviews?month=${view.prevMonth}`} className="btn-ghost">
          ← 上個月
        </Link>
        <p className="min-w-32 text-center text-lg font-semibold text-heading">
          {monthLabel(view.month)}
        </p>
        {view.nextMonth ? (
          <Link href={`/admin/reviews?month=${view.nextMonth}`} className="btn-ghost">
            下個月 →
          </Link>
        ) : (
          <span className="btn-ghost pointer-events-none opacity-40">下個月 →</span>
        )}
      </nav>

      <section>
        <h2 className="mb-1 text-lg font-semibold">每位老師</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          同一套題審好幾次（改判）只算一套；通過、退回依最後一次的判定。
        </p>
        {view.teachers.length === 0 ? (
          <p className="rounded-2xl border border-border bg-white px-5 py-6 text-center text-muted-foreground">
            這個月還沒有人審稿。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">老師</th>
                  <th className="px-4 py-3 text-right font-medium">審了幾套</th>
                  <th className="px-4 py-3 text-right font-medium">通過</th>
                  <th className="px-4 py-3 text-right font-medium">退回</th>
                </tr>
              </thead>
              <tbody>
                {view.teachers.map((t) => (
                  <tr key={t.reviewerId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{t.email ?? "（帳號已不存在）"}</td>
                    <td className="px-4 py-3 text-right text-lg font-bold">{t.sets}</td>
                    <td className="px-4 py-3 text-right">{t.approved}</td>
                    <td className="px-4 py-3 text-right">{t.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {view.entries.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">每一筆審稿</h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">時間</th>
                  <th className="px-4 py-3 font-medium">老師</th>
                  <th className="px-4 py-3 font-medium">題組</th>
                  <th className="px-4 py-3 font-medium">判定</th>
                </tr>
              </thead>
              <tbody>
                {view.entries.map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {time(e.reviewedAt)}
                    </td>
                    <td className="px-4 py-3">{e.email ?? "（帳號已不存在）"}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-primary">{e.setId}</span>
                      <span className="ml-2">{e.setTitle}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusTags tags={[e.decision === "approved" ? "TP" : "TR"]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
