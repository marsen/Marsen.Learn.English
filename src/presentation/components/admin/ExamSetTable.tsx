"use client";

import type { ExamSet } from "@/domain/examSet/examSet";
import type { ExamSetSummary } from "@/domain/examSet/examSetFilter";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { SUPPORTED_SCHEMA_VERSION } from "@/domain/examSet/bundle";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/presentation/components/ui/Button";
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
  /** 目前公開的題組（全站只有一張）；設別張為公開前會提示要取代它 */
  publicSetId?: string;
  /** 有刪除權限才給：每行出現勾選框，表格上方可以刪除選取的題組 */
  deleteAction?: (formData: FormData) => Promise<void>;
  /** 每套被寫過幾次（刪除確認用） */
  attemptCounts?: Record<string, number>;
};

const DELETE_FORM = "delete-sets";

/** 目前選中的那一格的顏色 */
const ACCESS_ACTIVE: Record<ExamSet["access"], string> = {
  unlisted: "bg-muted font-semibold text-foreground",
  members: "bg-primary font-semibold text-primary-foreground",
  public: "bg-accent font-semibold text-accent-foreground",
};

export function ExamSetTable({
  sets,
  filtered,
  setAccessAction,
  publicSetId,
  deleteAction,
  attemptCounts = {},
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  if (sets.length === 0)
    return <EmptyState>{t(filtered ? "sets.noMatch" : "sets.empty")}</EmptyState>;

  // 篩選改變後，畫面上已經沒有的題組不算進選取
  const chosen = sets.filter((s) => selected.has(s.setId)).map((s) => s.setId);
  const allChosen = chosen.length === sets.length;
  const toggle = (setId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });

  return (
    <>
      {deleteAction && (
        <form
          id={DELETE_FORM}
          action={deleteAction}
          className="mb-3 flex justify-end"
          onSubmit={(e) => {
            const taken = chosen.filter((id) => (attemptCounts[id] ?? 0) > 0).length;
            if (
              !window.confirm(
                t("sets.deleteSelectedConfirm", { count: chosen.length, taken }),
              )
            )
              e.preventDefault();
          }}
        >
          <Button
            type="submit"
            variant="dangerSecondary"
            size="sm"
            disabled={chosen.length === 0}
          >
            {t("sets.deleteSelected", { count: chosen.length })}
          </Button>
        </form>
      )}
      <Table
        head={
          <>
            {deleteAction && (
              <Th>
                <input
                  type="checkbox"
                  aria-label={t("sets.selectAll")}
                  checked={allChosen}
                  onChange={() =>
                    setSelected(allChosen ? new Set() : new Set(sets.map((s) => s.setId)))
                  }
                />
              </Th>
            )}
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
            {deleteAction && (
              <Td>
                <input
                  type="checkbox"
                  form={DELETE_FORM}
                  name="setId"
                  value={s.setId}
                  aria-label={t("sets.select", { setId: s.setId })}
                  checked={selected.has(s.setId)}
                  onChange={() => toggle(s.setId)}
                />
              </Td>
            )}
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
                        onClick={(e) => {
                          if (
                            a === "public" &&
                            publicSetId &&
                            publicSetId !== s.setId &&
                            !window.confirm(
                              t("sets.confirmReplacePublic", { setId: publicSetId }),
                            )
                          )
                            e.preventDefault();
                        }}
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
    </>
  );
}
