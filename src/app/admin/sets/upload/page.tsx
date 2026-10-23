import type { Metadata } from "next";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { BatchUploadForm } from "@/presentation/components/admin/BatchUploadForm";
import { requirePermission } from "@/infrastructure/auth/currentAccount";
import { uploadExamSetAction } from "@/app/actions/examSet";

export const metadata: Metadata = { title: "上傳題組", robots: { index: false } };

export default async function UploadSetPage() {
  await requirePermission("uploadSets");

  return (
    <Page>
      <PageHeader
        title="上傳題組"
        description="AI 有疑慮的題組也可以上傳，會交給老師審稿。"
      />

      <section className="rounded-2xl border border-border bg-surface p-6">
        <BatchUploadForm action={uploadExamSetAction} />
      </section>
    </Page>
  );
}
