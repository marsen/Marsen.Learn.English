import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { Alert } from "@/presentation/components/ui/Alert";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { ExamSetTable } from "@/presentation/components/admin/ExamSetTable";
import { ExamSetFilterBar } from "@/presentation/components/admin/ExamSetFilterBar";
import { can } from "@/domain/account/permission";
import { isFilterEmpty } from "@/domain/examSet/examSetFilter";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { getTrialExam, listExamSets } from "@/infrastructure/di/examSetContainer";
import { setExamAccessAction } from "@/app/actions/examSet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sets");
  return { title: t("title"), robots: { index: false } };
}

type SearchParams = Record<string, string | string[] | undefined>;

/** 同一個參數出現好幾次時取第一個 */
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ExamSetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const account = await requireAccount("/admin/sets");
  const sp = await searchParams;
  const view = await listExamSets().execute({
    actor: account,
    query: {
      status: first(sp.status),
      ai: first(sp.ai),
      access: first(sp.access),
      q: first(sp.q),
    },
  });
  if (!view) redirect("/admin?denied=1");
  // 公開題組（免費試卷）只有管理員能設，提示也只給管理員看
  const canSetAccess = can(account.roles, "setExamAccess");
  const trial = canSetAccess ? await getTrialExam().execute() : null;
  return (
    <Page width="lg">
      <DocumentTitle id="sets.title" />
      <PageHeader
        title={<Msg id="sets.title" />}
        actions={
          can(account.roles, "uploadSets") && (
            <ButtonLink href="/admin/sets/upload" size="sm">
              <Msg id="sets.upload" />
            </ButtonLink>
          )
        }
      />
      {canSetAccess &&
        (trial ? (
          <p className="mb-4 text-sm text-muted-foreground">
            <Msg id="sets.trialLabel" />{" "}
            <a
              href={`/admin/sets/${trial.setId}`}
              className="font-mono text-primary underline"
            >
              {trial.setId}
            </a>
          </p>
        ) : (
          <Alert tone="error" className="mb-4">
            <Msg id="sets.noTrialWarning" />
          </Alert>
        ))}
      <ExamSetFilterBar filter={view.filter} count={view.sets.length} />
      <ExamSetTable
        sets={view.sets}
        filtered={!isFilterEmpty(view.filter)}
        setAccessAction={canSetAccess ? setExamAccessAction : undefined}
        publicSetId={trial?.setId}
      />
    </Page>
  );
}
