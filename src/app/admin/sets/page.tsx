import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { ExamSetTable } from "@/presentation/components/admin/ExamSetTable";
import { ExamSetFilterBar } from "@/presentation/components/admin/ExamSetFilterBar";
import { can } from "@/domain/account/permission";
import { isFilterEmpty } from "@/domain/examSet/examSetFilter";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listExamSets } from "@/infrastructure/di/examSetContainer";
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
      <ExamSetFilterBar filter={view.filter} count={view.sets.length} />
      <ExamSetTable
        sets={view.sets}
        filtered={!isFilterEmpty(view.filter)}
        setAccessAction={
          can(account.roles, "setExamAccess") ? setExamAccessAction : undefined
        }
      />
    </Page>
  );
}
