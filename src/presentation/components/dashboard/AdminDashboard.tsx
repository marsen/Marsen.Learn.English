import Link from "next/link";
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

const who = (r: ReviewedSetView) => r.reviewerEmail ?? "老師";

/** 卡片上只列老師寫的意見；AI 的意見、題目、逐字稿在複製的完整回饋裡 */
const teacherComments = (r: RejectedSetView) =>
  [
    r.comment && `整體意見：${r.comment}`,
    ...r.notes.map((n) => `${n.target ?? "整套／錄音"}：${n.text}`),
  ]
    .filter(Boolean)
    .join("\n");

/** 管理員總覽：可以上架、有問題、題目分類統計。 */
export function AdminDashboard({ view, setAccessAction, deleteAction }: Props) {
  const c = view.counts;
  const kpis = [
    { label: "等老師審", n: c.pending, tone: "" },
    { label: "可以上架", n: c.readyToList, tone: "border-accent/50 bg-accent-soft/40" },
    { label: "有問題", n: c.rejected, tone: "border-destructive/40 bg-destructive/5" },
    { label: "上架中", n: c.listed, tone: "" },
    { label: "公開試考", n: c.public, tone: "" },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-2xl border border-border bg-surface p-4 ${k.tone}`}
          >
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-3xl font-bold">{k.n}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-1 text-lg font-semibold text-heading">可以上架</h2>
      <p className="mb-3 text-sm text-muted-foreground">老師已通過、目前還是下架。</p>
      {view.readyToList.length === 0 ? (
        <EmptyState>沒有等著上架的題組。</EmptyState>
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
                {who(r)} {day(r.reviewedAt)} 通過
              </Td>
              <Td align="right" className="whitespace-nowrap">
                <form action={setAccessAction} className="inline-flex gap-2">
                  <CopyButton text={r.feedback} label="📋 複製回饋" />
                  <input type="hidden" name="setId" value={r.set.setId} />
                  <Button type="submit" name="access" value="members" size="sm">
                    上架
                  </Button>
                  <Button
                    type="submit"
                    name="access"
                    value="public"
                    variant="secondary"
                    size="sm"
                  >
                    設為公開
                  </Button>
                </form>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <h2 className="mt-10 mb-1 text-lg font-semibold text-heading">有問題</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        老師退回的題組。修好就上傳新版本，修不了就刪掉。
      </p>
      {view.rejected.length === 0 ? (
        <EmptyState>沒有被退回的題組。</EmptyState>
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
                  {who(r)} {day(r.reviewedAt)} 退回
                </span>
              </div>
              <pre className="mt-3 rounded-lg bg-muted px-4 py-3 font-sans text-sm whitespace-pre-wrap">
                {teacherComments(r) || "（老師沒有寫意見）"}
              </pre>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {r.reviewerEmail && (
                  <a
                    href={`mailto:${r.reviewerEmail}?subject=${encodeURIComponent(`題組 ${r.set.setId} 審稿討論`)}`}
                    className={buttonClass({ variant: "secondary", size: "sm" })}
                  >
                    💬 找老師討論
                  </a>
                )}
                <CopyButton text={r.feedback} label="📋 複製回饋（貼給 AI）" />
                <ButtonLink href="/admin/sets/upload" variant="secondary" size="sm">
                  ⬆︎ 上傳修正版
                </ButtonLink>
                <DeleteSetButton setId={r.set.setId} action={deleteAction} />
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-3 flex items-center gap-2 text-lg font-semibold text-heading">
        情境主題統計
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
          假資料
        </span>
      </h2>
      <TopicChart />
    </section>
  );
}
