"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type {
  AdminDashboardView,
  RejectedSetView,
  ReviewedSetView,
} from "@/application/dashboard/adminDashboard";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { StatusTags } from "@/presentation/components/admin/StatusTags";
import { CopyButton } from "./CopyButton";
import { DeleteSetButton } from "./DeleteSetButton";
import { TopicChart } from "./TopicChart";
import { Button, ButtonLink, buttonClass } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Tr } from "@/presentation/components/ui/Table";
import { formatDay } from "@/presentation/lib/format";

type Props = {
  view: AdminDashboardView;
  setAccessAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

const day = (d: Date | null) => (d ? formatDay(d) : "");

type Translate = (key: string, values?: Record<string, string | number>) => string;

const who = (t: Translate, r: ReviewedSetView) => r.reviewerEmail ?? t("teacherFallback");

/** 卡片上只列老師寫的意見；AI 的意見、題目、逐字稿在複製的完整回饋裡 */
const teacherComments = (t: Translate, r: RejectedSetView) =>
  [
    r.comment && t("overallComment", { text: r.comment }),
    ...r.notes.map((n) =>
      t("noteLine", { target: n.target ?? t("noteTargetWhole"), text: n.text }),
    ),
  ]
    .filter(Boolean)
    .join("\n");

/** 管理員總覽：可以上架、有問題、題目分類統計。 */
export function AdminDashboard({ view, setAccessAction, deleteAction }: Props) {
  const t = useTranslations("adminDashboard");
  const c = view.counts;
  const kpis = [
    { key: "pending", label: t("kpiPending"), n: c.pending, tone: "" },
    {
      key: "ready",
      label: t("kpiReady"),
      n: c.readyToList,
      tone: "border-accent/50 bg-accent-soft/40",
    },
    {
      key: "rejected",
      label: t("kpiRejected"),
      n: c.rejected,
      tone: "border-destructive/40 bg-destructive/5",
    },
    { key: "listed", label: t("kpiListed"), n: c.listed, tone: "" },
    { key: "public", label: t("kpiPublic"), n: c.public, tone: "" },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.key}
            className={`rounded-2xl border border-border bg-surface p-4 ${k.tone}`}
          >
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-3xl font-bold">{k.n}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-1 text-lg font-semibold text-heading">
        {t("readyHeading")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("readyHint")}</p>
      {view.readyToList.length === 0 ? (
        <EmptyState>{t("readyEmpty")}</EmptyState>
      ) : (
        <Table>
          {view.readyToList.map((r) => (
            <Tr key={r.set.setId}>
              <Td className="font-mono whitespace-nowrap">
                <Link
                  href={`/admin/sets/${r.set.setId}`}
                  className="text-primary underline"
                >
                  {r.set.setId}
                </Link>
              </Td>
              <Td>{r.set.title}</Td>
              <Td className="whitespace-nowrap">
                <StatusTags tags={statusTagsOf(r.set)} />
              </Td>
              <Td className="text-xs whitespace-nowrap text-muted-foreground">
                {t("approvedBy", { who: who(t, r), day: day(r.reviewedAt) })}
              </Td>
              <Td align="right" className="whitespace-nowrap">
                <form action={setAccessAction} className="inline-flex gap-2">
                  <CopyButton text={r.feedback} label={t("copyFeedback")} />
                  <input type="hidden" name="setId" value={r.set.setId} />
                  <Button type="submit" name="access" value="members" size="sm">
                    {t("list")}
                  </Button>
                  <Button
                    type="submit"
                    name="access"
                    value="public"
                    variant="secondary"
                    size="sm"
                  >
                    {t("makePublic")}
                  </Button>
                </form>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <h2 className="mt-10 mb-1 text-lg font-semibold text-heading">
        {t("rejectedHeading")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("rejectedHint")}</p>
      {view.rejected.length === 0 ? (
        <EmptyState>{t("rejectedEmpty")}</EmptyState>
      ) : (
        <div className="grid gap-3">
          {view.rejected.map((r) => (
            <article
              key={r.set.setId}
              className="rounded-2xl border border-destructive/30 bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/sets/${r.set.setId}`}
                  className="font-mono text-primary underline"
                >
                  {r.set.setId}
                </Link>
                <span>{r.set.title}</span>
                <StatusTags tags={statusTagsOf(r.set)} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("rejectedBy", { who: who(t, r), day: day(r.reviewedAt) })}
                </span>
              </div>
              <pre className="mt-3 rounded-lg bg-muted px-4 py-3 font-sans text-sm whitespace-pre-wrap">
                {teacherComments(t, r) || t("noComments")}
              </pre>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {r.reviewerEmail && (
                  <a
                    href={`mailto:${r.reviewerEmail}?subject=${encodeURIComponent(t("mailSubject", { setId: r.set.setId }))}`}
                    className={buttonClass({ variant: "secondary", size: "sm" })}
                  >
                    {t("discuss")}
                  </a>
                )}
                <CopyButton text={r.feedback} label={t("copyFeedbackForAi")} />
                <ButtonLink href="/admin/sets/upload" variant="secondary" size="sm">
                  {t("uploadFix")}
                </ButtonLink>
                <DeleteSetButton setId={r.set.setId} action={deleteAction} />
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-3 flex items-center gap-2 text-lg font-semibold text-heading">
        {t("topicsHeading")}
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
          {t("fakeData")}
        </span>
      </h2>
      <TopicChart />
    </section>
  );
}
