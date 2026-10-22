import type { ReviewLogView } from "@/application/dashboard/reviewLog";
import { StatusTags } from "./StatusTags";
import { ButtonLink, buttonClass } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { formatDateTime } from "@/presentation/lib/format";

const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${y} 年 ${Number(mm)} 月`;
};

/** 審稿紀錄：每位老師這個月審了幾套，以及每一筆審稿。 */
export function ReviewLog({ view }: { view: ReviewLogView }) {
  return (
    <div className="grid gap-10">
      <nav className="flex items-center gap-3" aria-label="切換月份">
        <ButtonLink
          href={`/admin/reviews?month=${view.prevMonth}`}
          variant="secondary"
          size="sm"
        >
          ← 上個月
        </ButtonLink>
        <p className="min-w-32 text-center text-lg font-semibold text-heading">
          {monthLabel(view.month)}
        </p>
        {view.nextMonth ? (
          <ButtonLink
            href={`/admin/reviews?month=${view.nextMonth}`}
            variant="secondary"
            size="sm"
          >
            下個月 →
          </ButtonLink>
        ) : (
          <span
            className={buttonClass({
              variant: "secondary",
              size: "sm",
              className: "opacity-40",
            })}
          >
            下個月 →
          </span>
        )}
      </nav>

      <section>
        <h2 className="mb-1 text-lg font-semibold">每位老師</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          同一套題審好幾次（改判）只算一套；通過、退回依最後一次的判定。
        </p>
        {view.teachers.length === 0 ? (
          <EmptyState>這個月還沒有人審稿。</EmptyState>
        ) : (
          <Table
            head={
              <>
                <Th>老師</Th>
                <Th align="right">審了幾套</Th>
                <Th align="right">通過</Th>
                <Th align="right">退回</Th>
              </>
            }
          >
            {view.teachers.map((t) => (
              <Tr key={t.reviewerId}>
                <Td>{t.email ?? "（帳號已不存在）"}</Td>
                <Td align="right" className="text-lg font-bold">
                  {t.sets}
                </Td>
                <Td align="right">{t.approved}</Td>
                <Td align="right">{t.rejected}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </section>

      {view.entries.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">每一筆審稿</h2>
          <Table
            head={
              <>
                <Th>時間</Th>
                <Th>老師</Th>
                <Th>題組</Th>
                <Th>判定</Th>
              </>
            }
          >
            {view.entries.map((e, i) => (
              <Tr key={i}>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(e.reviewedAt)}
                </Td>
                <Td>{e.email ?? "（帳號已不存在）"}</Td>
                <Td>
                  <span className="font-mono text-primary">{e.setId}</span>
                  <span className="ml-2">{e.setTitle}</span>
                </Td>
                <Td>
                  <StatusTags tags={[e.decision === "approved" ? "TP" : "TR"]} />
                </Td>
              </Tr>
            ))}
          </Table>
        </section>
      )}
    </div>
  );
}
