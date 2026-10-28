"use client";

import { useTranslations } from "next-intl";
import type { ReviewLogView } from "@/application/dashboard/reviewLog";
import { StatusTags } from "./StatusTags";
import { ButtonLink, buttonClass } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { formatDateTime } from "@/presentation/lib/format";

/** 審稿紀錄：每位老師這個月審了幾套，以及每一筆審稿。 */
export function ReviewLog({ view }: { view: ReviewLogView }) {
  const t = useTranslations("reviewLog");
  const [year, month] = view.month.split("-");
  return (
    <div className="grid gap-10">
      <nav className="flex items-center gap-3" aria-label={t("monthNav")}>
        <ButtonLink
          href={`/admin/reviews?month=${view.prevMonth}`}
          variant="secondary"
          size="sm"
        >
          {t("prev")}
        </ButtonLink>
        <p className="min-w-32 text-center text-lg font-semibold text-heading">
          {t("month", { year, month: Number(month) })}
        </p>
        {view.nextMonth ? (
          <ButtonLink
            href={`/admin/reviews?month=${view.nextMonth}`}
            variant="secondary"
            size="sm"
          >
            {t("next")}
          </ButtonLink>
        ) : (
          <span
            className={buttonClass({
              variant: "secondary",
              size: "sm",
              className: "opacity-40",
            })}
          >
            {t("next")}
          </span>
        )}
      </nav>

      <section>
        <h2 className="mb-1 text-lg font-semibold">{t("teachersHeading")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("teachersHint")}</p>
        {view.teachers.length === 0 ? (
          <EmptyState>{t("empty")}</EmptyState>
        ) : (
          <Table
            head={
              <>
                <Th>{t("colTeacher")}</Th>
                <Th align="right">{t("colSets")}</Th>
                <Th align="right">{t("colApproved")}</Th>
                <Th align="right">{t("colRejected")}</Th>
              </>
            }
          >
            {view.teachers.map((r) => (
              <Tr key={r.reviewerId}>
                <Td>{r.email ?? t("deletedAccount")}</Td>
                <Td align="right" className="text-lg font-bold">
                  {r.sets}
                </Td>
                <Td align="right">{r.approved}</Td>
                <Td align="right">{r.rejected}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </section>

      {view.entries.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("entriesHeading")}</h2>
          <Table
            head={
              <>
                <Th>{t("colTime")}</Th>
                <Th>{t("colTeacher")}</Th>
                <Th>{t("colSet")}</Th>
                <Th>{t("colDecision")}</Th>
              </>
            }
          >
            {view.entries.map((e, i) => (
              <Tr key={i}>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(e.reviewedAt)}
                </Td>
                <Td>{e.email ?? t("deletedAccount")}</Td>
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
