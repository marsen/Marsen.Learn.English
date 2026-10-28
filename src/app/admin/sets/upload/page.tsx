import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { BatchUploadForm } from "@/presentation/components/admin/BatchUploadForm";
import { requirePermission } from "@/infrastructure/auth/currentAccount";
import { uploadExamSetAction } from "@/app/actions/examSet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("uploadSet");
  return { title: t("title"), robots: { index: false } };
}

export default async function UploadSetPage() {
  await requirePermission("uploadSets");

  return (
    <Page>
      <DocumentTitle id="uploadSet.title" />
      <PageHeader
        title={<Msg id="uploadSet.title" />}
        description={<Msg id="uploadSet.description" />}
      />

      <section className="rounded-2xl border border-border bg-surface p-6">
        <BatchUploadForm action={uploadExamSetAction} />
      </section>
    </Page>
  );
}
