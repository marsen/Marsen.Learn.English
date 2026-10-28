"use client";

import type { ExamSet } from "@/domain/examSet/examSet";
import type { ExamSetSummary } from "@/domain/examSet/examSetFilter";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { SUPPORTED_SCHEMA_VERSION } from "@/domain/examSet/bundle";
import { useLocale, useTranslations } from "next-intl";
import { ACCESS_ORDER } from "@/presentation/lib/examSetLabels";
import { StatusTags } from "./StatusTags";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { formatDateTime } from "@/presentation/lib/format";

type Props = {
  sets: ExamSetSummary[];
  /** 有套用過濾條件：沒資料時顯示「沒有符合條件」而不是「還沒有題組」 */
  filtered?: boolean;
  /** 有「設定考卷開放對象」權限才給，沒給就只顯示不能改 */
  setAccessAction?: (formData: FormData) => Promise<void>;
};

/** 目前選中的那一格的顏色 */
const ACCESS_ACTIVE: Record<ExamSet["access"], string> = {
  unlisted: "bg-muted font-semibold text-foreground",
  members: "bg-primary font-semibold text-primary-foreground",
  public: "bg-accent font-semibold text-accent-foreground",
};

export function ExamSetTable({ sets, filtered, setAccessAction }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  if (sets.length === 0)
    return <EmptyState>{t(filtered ? "sets.noMatch" : "sets.empty")}</EmptyState>;

  return (
    <Table
      head={
        <>
          <Th>{t("sets.colSet")}</Th>
          <Th>{t("sets.colTitle")}</Th>
          <Th>{t("sets.colCount")}</Th>
          <Th>{t("sets.colVersion")}</Th>
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
          <Td className="whitespace-nowrap">
            <span
              title={t(
                s.schemaMinor > 0
                  ? "sets.versionHint.transcript"
                  : "sets.versionHint.noTranscript",
              )}
              className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                s.schemaMinor > 0
                  ? "bg-accent-soft text-accent-hover"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {SUPPORTED_SCHEMA_VERSION}.{s.schemaMinor}
            </span>
          </Td>
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
