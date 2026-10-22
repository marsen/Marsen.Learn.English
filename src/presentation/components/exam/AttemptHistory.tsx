import type { AttemptRecord } from "@/application/exam/examResult";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { formatFullDateTime } from "@/presentation/lib/format";

/** 我的考試紀錄：日期、考卷、分數，點進去看完整結果。 */
export function AttemptHistory({ records }: { records: AttemptRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyState>
        還沒有紀錄。
        <a href="/exam" className="text-primary underline">
          去寫一張考卷
        </a>
      </EmptyState>
    );
  }
  return (
    <Table
      head={
        <>
          <Th>交卷時間</Th>
          <Th>考卷</Th>
          <Th>分數</Th>
          <Th />
        </>
      }
    >
      {records.map((r) => (
        <Tr key={r.attemptId}>
          <Td className="whitespace-nowrap text-muted-foreground">
            {formatFullDateTime(r.submittedAt)}
          </Td>
          <Td>{r.title}</Td>
          <Td className="font-medium">
            {r.score} / {r.total}
          </Td>
          <Td>
            <a href={`/exam/result/${r.attemptId}`} className="text-primary underline">
              看結果
            </a>
          </Td>
        </Tr>
      ))}
    </Table>
  );
}
