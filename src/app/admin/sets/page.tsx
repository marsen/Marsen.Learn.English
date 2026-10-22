import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { ButtonLink } from "@/presentation/components/ui/Button";
import { ExamSetTable } from "@/presentation/components/admin/ExamSetTable";
import { can } from "@/domain/account/permission";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listExamSets } from "@/infrastructure/di/examSetContainer";
import { setExamAccessAction } from "@/app/actions/examSet";

export const metadata: Metadata = { title: "題組", robots: { index: false } };

export default async function ExamSetsPage() {
  const account = await requireAccount("/admin/sets");
  const sets = await listExamSets().execute({ actor: account });
  if (!sets) redirect("/admin?denied=1");

  return (
    <Page width="lg">
      <PageHeader
        title="題組"
        actions={
          can(account.roles, "uploadSets") && (
            <ButtonLink href="/admin/sets/upload" size="sm">
              上傳題組
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
