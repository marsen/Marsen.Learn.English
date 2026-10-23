import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { ExamSetTable } from "@/presentation/components/admin/ExamSetTable";
import { can } from "@/domain/account/permission";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listExamSets } from "@/infrastructure/di/examSetContainer";
import { setExamAccessAction } from "@/app/actions/examSet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sets");
  return { title: t("title"), robots: { index: false } };
}

export default async function ExamSetsPage() {
  const account = await requireAccount("/admin/sets");
  const sets = await listExamSets().execute({ actor: account });
  if (!sets) redirect("/admin?denied=1");
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
      <ExamSetTable
        sets={sets}
        setAccessAction={
          can(account.roles, "setExamAccess") ? setExamAccessAction : undefined
        }
      />
    </Page>
  );
}
