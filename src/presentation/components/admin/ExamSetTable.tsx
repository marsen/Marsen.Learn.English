import type { ExamSet } from "@/domain/examSet/examSet";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import {
  ACCESS_HINTS,
  ACCESS_LABELS,
  ACCESS_ORDER,
} from "@/presentation/lib/examSetLabels";
import { StatusTags } from "./StatusTags";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { formatDateTime } from "@/presentation/lib/format";

type Props = {
  sets: ExamSet[];
  /** 有「設定考卷開放對象」權限才給，沒給就只顯示不能改 */
  setAccessAction?: (formData: FormData) => Promise<void>;
};

/** 目前選中的那一格的顏色 */
const ACCESS_ACTIVE: Record<ExamSet["access"], string> = {
  unlisted: "bg-muted font-semibold text-foreground",
  members: "bg-primary font-semibold text-primary-foreground",
  public: "bg-accent font-semibold text-accent-foreground",
};

export function ExamSetTable({ sets, setAccessAction }: Props) {
  if (sets.length === 0) return <EmptyState>還沒有題組。</EmptyState>;

  return (
    <Table
      head={
        <>
          <Th>題組</Th>
          <Th>標題</Th>
          <Th>題數</Th>
          <Th>審核狀態</Th>
          <Th>開放對象</Th>
          <Th>上傳時間</Th>
        </>
      }
    >
      {sets.map((s) => (
        <Tr key={s.setId}>
          <Td className="font-mono whitespace-nowrap">
            <a href={`/admin/sets/${s.setId}`} className="text-primary underline">
              {s.setId}
            </a>
          </Td>
          <Td>{s.title}</Td>
          <Td className="whitespace-nowrap">{s.questionCount}</Td>
          <Td>
            <StatusTags tags={statusTagsOf(s)} />
          </Td>
          <Td>
            {setAccessAction ? (
              <form
                action={setAccessAction}
                className="inline-flex overflow-hidden rounded-full ring-1 ring-border ring-inset"
              >
                <input type="hidden" name="setId" value={s.setId} />
                {ACCESS_ORDER.map((a) => {
                  const current = a === s.access;
                  return (
                    <button
                      key={a}
                      type="submit"
                      name="access"
                      value={a}
                      disabled={current}
                      aria-pressed={current}
                      title={ACCESS_HINTS[a]}
                      className={`px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                        current
                          ? ACCESS_ACTIVE[a]
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {ACCESS_LABELS[a]}
                    </button>
                  );
                })}
              </form>
            ) : (
              <span className="whitespace-nowrap" title={ACCESS_HINTS[s.access]}>
                {ACCESS_LABELS[s.access]}
              </span>
            )}
          </Td>
          <Td className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(s.uploadedAt)}
          </Td>
        </Tr>
      ))}
    </Table>
  );
}
