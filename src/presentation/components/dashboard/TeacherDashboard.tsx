import { useTranslations } from "next-intl";
import type { TeacherDashboardView } from "@/application/dashboard/teacherDashboard";
import { StatusTags } from "@/presentation/components/admin/StatusTags";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { EmptyState } from "@/presentation/components/ui/EmptyState";
import { Table, Td, Th, Tr } from "@/presentation/components/ui/Table";
import { waitedDays } from "@/presentation/lib/waiting";

/** 老師總覽：還沒審的題組（別的老師審完就會消失）、這個月審了幾套。 */
export function TeacherDashboard({
  view,
  now,
}: {
  view: TeacherDashboardView;
  now: Date;
}) {
  const t = useTranslations();
  const oldest = view.pending[0];
  const waited = (since: Date) => {
    const days = waitedDays(since, now);
    return days === 0 ? t("waited.today") : t("waited.days", { days });
  };

  return (
    <section>
      <p className="text-sm text-muted-foreground">{t("teacherDashboard.intro")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/40 bg-primary-soft/40 p-5 sm:col-span-2">
          <p className="text-sm text-primary-hover">{t("teacherDashboard.pending")}</p>
          <p className="mt-1 text-5xl font-bold text-heading">
            {view.pending.length}{" "}
            <span className="text-lg font-medium">{t("common.setsUnit")}</span>
          </p>
          {oldest && (
            <p className="mt-2 text-sm text-primary-hover">
              {waitedDays(oldest.uploadedAt, now) === 0
                ? t("teacherDashboard.oldestToday")
                : t("teacherDashboard.oldestWaited", {
                    waited: waited(oldest.uploadedAt),
                  })}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted-foreground">
            {t("teacherDashboard.reviewedThisMonth")}
          </p>
          <p className="mt-1 text-4xl font-bold">
            {view.reviewedThisMonth}{" "}
            <span className="text-base font-medium">{t("common.setsUnit")}</span>
          </p>
        </div>
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold text-heading">
        {t("teacherDashboard.listTitle")}
      </h2>
      {view.pending.length === 0 ? (
        <EmptyState>{t("teacherDashboard.empty")}</EmptyState>
      ) : (
        <Table
          head={
            <>
              <Th>{t("teacherDashboard.colSet")}</Th>
              <Th>{t("teacherDashboard.colTitle")}</Th>
              <Th>{t("teacherDashboard.colAi")}</Th>
              <Th>{t("teacherDashboard.colWaited")}</Th>
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
                    {t("teacherDashboard.findings", { count: s.findingCount })}
                  </span>
                )}
              </Td>
              <Td className="whitespace-nowrap">{waited(s.uploadedAt)}</Td>
              <Td align="right">
                <ButtonLink href={`/admin/sets/${s.setId}`} size="sm">
                  {t("teacherDashboard.startReview")}
                </ButtonLink>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </section>
  );
}
