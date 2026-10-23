import Link from "next/link";
import type { StudentDashboardView } from "@/application/dashboard/studentDashboard";
import { trapLabel } from "@/presentation/lib/examSetLabels";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { formatDay } from "@/presentation/lib/format";

const pct = (score: number, total: number) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

/** 學生總覽：繼續練習、還有幾張沒考、我的成績、最常錯的題型。 */
export function StudentDashboard({ view }: { view: StudentDashboardView }) {
  const rec = view.recommendation;
  const last = view.recent.at(-1);

  return (
    <section className="mt-6 grid gap-10">
      {/* 繼續練習 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/40 bg-primary-soft/40 p-6 sm:col-span-2">
          {rec ? (
            <>
              <p className="text-sm text-primary-hover">
                {rec.reason === "new"
                  ? "下一張推薦給你"
                  : "全部考過了！挑分數最低的再挑戰一次"}
              </p>
              <p className="mt-1 text-2xl font-bold text-heading">{rec.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {rec.questionCount} 題
                {rec.bestPercent !== null && ` ・ 上次最好 ${rec.bestPercent} 分`}
              </p>
              <ButtonLink href={`/exam/${rec.setId}`} className="mt-4">
                {rec.reason === "new" ? "開始練習" : "再挑戰"}
              </ButtonLink>
            </>
          ) : (
            <p className="text-muted-foreground">
              目前還沒有可以考的考卷，晚點再來看看。
            </p>
          )}
        </div>
        <Link
          href="/exam"
          className="rounded-2xl border border-border bg-white p-6 transition-colors hover:bg-muted"
        >
          <p className="text-sm text-muted-foreground">還沒考過的考卷</p>
          <p className="mt-1 text-5xl font-bold">
            {view.notTakenCount} <span className="text-lg font-medium">張</span>
          </p>
          <p className="mt-2 text-sm text-primary">
            {view.notTakenCount > 0 ? "等你挑戰 →" : "看全部考卷 →"}
          </p>
        </Link>
      </div>

      {/* 我的成績 */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">我的成績</h2>
        {view.attemptCount === 0 ? (
          <EmptyState>考完第一張，這裡就會出現你的成績。</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm text-muted-foreground">考了</p>
              <p className="mt-1 text-3xl font-bold">
                {view.attemptCount} <span className="text-base font-medium">次</span>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm text-muted-foreground">平均答對</p>
              <p className="mt-1 text-3xl font-bold">
                {view.averagePercent}
                <span className="text-base font-medium">%</span>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm text-muted-foreground">最近一次</p>
              {last && (
                <p className="mt-1 text-3xl font-bold">
                  {last.score}
                  <span className="text-base font-medium"> / {last.total}</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 sm:col-span-3">
              <p className="mb-4 text-sm text-muted-foreground">
                最近 {view.recent.length} 次
              </p>
              <ol className="flex h-40 items-end gap-3">
                {view.recent.map((r) => {
                  const p = pct(r.score, r.total);
                  return (
                    <li
                      key={r.attemptId}
                      className="flex h-full max-w-20 flex-1 flex-col justify-end"
                    >
                      <Link
                        href={`/exam/result/${r.attemptId}`}
                        title={`${r.title}：${r.score} / ${r.total}`}
                        className="group flex h-full flex-col justify-end"
                      >
                        <span className="mb-1 text-center text-xs font-semibold">
                          {p}%
                        </span>
                        <span
                          className="block rounded-t-md bg-accent transition-opacity group-hover:opacity-80"
                          style={{ height: `${Math.max(p, 3)}%` }}
                        />
                        <span className="mt-1 text-center text-xs text-muted-foreground">
                          {formatDay(r.submittedAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* 最常錯的題型 */}
      {view.weakTraps.length > 0 && (
        <div>
          <h2 className="mb-1 text-lg font-semibold">最常錯的題型</h2>
          <p className="mb-3 text-sm text-muted-foreground">練習時特別留意這幾種陷阱。</p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {view.weakTraps.map((t) => (
              <li key={t.trap} className="rounded-2xl border border-border bg-white p-5">
                <p className="font-semibold">{trapLabel(t.trap)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  錯 <b className="text-destructive">{t.wrong}</b> / {t.seen} 題
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
