import { ButtonLink } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
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
        <EmptyState>目前沒有要審的題組，辛苦了。</EmptyState>
      ) : (
        <Table
          head={
            <>
              <Th>題組</Th>
              <Th>標題</Th>
              <Th>AI 怎麼說</Th>
              <Th>等了</Th>
              <Th />
            </>
          }
        >
          {view.pending.map((s) => (
            <Tr key={s.setId}>
              <Td className="font-mono whitespace-nowrap text-primary">{s.setId}</Td>
              <Td>{s.title}</Td>
              <Td className="whitespace-nowrap">
                <StatusTags tags={[s.aiVerdict === "pass" ? "AIP" : "AI_WARN"]} />
                {s.aiVerdict !== "pass" && s.findingCount > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.findingCount} 個疑點
                  </span>
                )}
              </Td>
              <Td className="whitespace-nowrap">{waitedLabel(s.uploadedAt, now)}</Td>
              <Td align="right">
                <ButtonLink href={`/admin/sets/${s.setId}`} size="sm">
                  開始審稿
                </ButtonLink>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </section>
  );
}
