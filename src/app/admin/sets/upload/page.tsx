import type { Metadata } from "next";
import { BatchUploadForm } from "@/presentation/components/admin/BatchUploadForm";
import { UploadSetForm } from "@/presentation/components/admin/UploadSetForm";
import { requirePermission } from "@/infrastructure/auth/currentAccount";
import { uploadExamSetAction } from "@/app/actions/examSet";

export const metadata: Metadata = { title: "上傳題組", robots: { index: false } };

export default async function UploadSetPage() {
  await requirePermission("uploadSets");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <h1 className="text-2xl font-bold">上傳題組</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        AI 有疑慮的題組也可以上傳，會交給老師審稿。
      </p>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">批次上傳</h2>
        <BatchUploadForm action={uploadExamSetAction} />
      </section>

      <details className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <summary className="cursor-pointer text-lg font-semibold text-heading">
          只上傳一套
        </summary>
        <div className="mt-4">
          <UploadSetForm action={uploadExamSetAction} />
        </div>
      </details>
    </main>
  );
}
