"use client";

import Link from "next/link";
import type { StudentDashboardView } from "@/application/dashboard/studentDashboard";
import { useTranslations } from "next-intl";
import { examSetLabel } from "@/presentation/lib/examSetLabels";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { formatDay } from "@/presentation/lib/format";

const pct = (score: number, total: number) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

/** 學生總覽：繼續練習、還有幾張沒考、我的成績、最常錯的題型。 */
export function StudentDashboard({ view }: { view: StudentDashboardView }) {
  const t = useTranslations();
  const ts = useTranslations("studentDashboard");
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
                {rec.reason === "new" ? ts("recommendNew") : ts("recommendRetry")}
              </p>
              <p className="mt-1 text-2xl font-bold text-heading">{rec.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ts("questionCount", { count: rec.questionCount })}
                {rec.bestPercent !== null &&
                  ts("bestScore", { percent: rec.bestPercent })}
              </p>
              <ButtonLink href={`/exam/${rec.setId}`} className="mt-4">
                {rec.reason === "new" ? ts("start") : ts("retry")}
              </ButtonLink>
            </>
          ) : (
            <p className="text-muted-foreground">{ts("noExams")}</p>
          )}
        </div>
        <Link
          href="/exam"
          className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:bg-muted"
        >
          <p className="text-sm text-muted-foreground">{ts("notTaken")}</p>
          <p className="mt-1 text-5xl font-bold">
            {view.notTakenCount}{" "}
            <span className="text-lg font-medium">
              {ts("papersUnit", { count: view.notTakenCount })}
            </span>
          </p>
          <p className="mt-2 text-sm text-primary">
            {view.notTakenCount > 0 ? ts("challenge") : ts("viewAll")}
          </p>
        </Link>
      </div>

      {/* 我的成績 */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{ts("scoresHeading")}</h2>
        {view.attemptCount === 0 ? (
          <EmptyState>{ts("scoresEmpty")}</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm text-muted-foreground">{ts("attempts")}</p>
              <p className="mt-1 text-3xl font-bold">
                {view.attemptCount}{" "}
                <span className="text-base font-medium">
                  {ts("timesUnit", { count: view.attemptCount })}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm text-muted-foreground">{ts("average")}</p>
              <p className="mt-1 text-3xl font-bold">
                {view.averagePercent}
                <span className="text-base font-medium">%</span>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm text-muted-foreground">{ts("latest")}</p>
              {last && (
                <p className="mt-1 text-3xl font-bold">
                  {last.score}
                  <span className="text-base font-medium"> / {last.total}</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 sm:col-span-3">
              <p className="mb-4 text-sm text-muted-foreground">
                {ts("recentN", { count: view.recent.length })}
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
                        title={ts("barTitle", {
                          title: r.title ?? t("common.deletedSet"),
                          score: r.score,
                          total: r.total,
                        })}
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
          <h2 className="mb-1 text-lg font-semibold">{ts("weakHeading")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{ts("weakHint")}</p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {view.weakTraps.map((w) => (
              <li
                key={w.trap}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <p className="font-semibold">{examSetLabel(t, "trap", w.trap)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ts.rich("weakStat", {
                    wrong: w.wrong,
                    seen: w.seen,
                    b: (chunks) => <b className="text-destructive">{chunks}</b>,
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
