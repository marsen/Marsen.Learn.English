import type { Metadata } from "next";
import { UploadSetForm } from "@/presentation/components/admin/UploadSetForm";
import { requirePermission } from "@/infrastructure/auth/currentAccount";
import { uploadExamSetAction } from "@/app/actions/examSet";

export const metadata: Metadata = { title: "上傳題組", robots: { index: false } };

export default async function UploadSetPage() {
  await requirePermission("uploadSets");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <a href="/admin/sets" className="text-sm text-muted-foreground underline">
        ← 題組
      </a>
      <h1 className="mt-4 font-display text-2xl font-semibold">上傳題組</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        選 Question.Generator 打包出的 set.json 和 audio.mp3。AI
        有疑慮的題組也可以上傳，會交給老師審稿。
      </p>
      <UploadSetForm action={uploadExamSetAction} />
    </main>
  );
}
