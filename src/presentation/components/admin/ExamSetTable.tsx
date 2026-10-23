"use client";

import type { ExamSet } from "@/domain/examSet/examSet";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { useLocale, useTranslations } from "next-intl";
import { ACCESS_ORDER } from "@/presentation/lib/examSetLabels";
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
  const t = useTranslations();
  const locale = useLocale();
  if (sets.length === 0) return <EmptyState>{t("sets.empty")}</EmptyState>;

  return (
    <Table
      head={
        <>
          <Th>{t("sets.colSet")}</Th>
          <Th>{t("sets.colTitle")}</Th>
          <Th>{t("sets.colCount")}</Th>
          <Th>{t("sets.colStatus")}</Th>
          <Th>{t("sets.colAccess")}</Th>
          <Th>{t("sets.colUploaded")}</Th>
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
                      title={t(`examSet.accessHint.${a}`)}
                      className={`px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                        current
                          ? ACCESS_ACTIVE[a]
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {t(`examSet.access.${a}`)}
                    </button>
                  );
                })}
              </form>
            ) : (
              <span
                className="whitespace-nowrap"
                title={t(`examSet.accessHint.${s.access}`)}
              >
                {t(`examSet.access.${s.access}`)}
              </span>
            )}
          </Td>
          <Td className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(s.uploadedAt, locale)}
          </Td>
        </Tr>
      ))}
    </Table>
  );
}
