import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <div className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">題組</h1>
        {can(account.roles, "uploadSets") && (
          <a
            href="/admin/sets/upload"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            上傳題組
          </a>
        )}
      </div>
      <ExamSetTable
        sets={sets}
        setAccessAction={
          can(account.roles, "setExamAccess") ? setExamAccessAction : undefined
        }
      />
    </main>
  );
}
