import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/presentation/components/admin/ReviewForm";
import { StatusTags } from "@/presentation/components/admin/StatusTags";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { getExamSetForReview } from "@/infrastructure/di/examSetContainer";
import { reviewExamSetAction } from "@/app/actions/examSet";

export const metadata: Metadata = { title: "審稿", robots: { index: false } };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;
  const account = await requireAccount(`/admin/sets/${setId}`);
  const result = await getExamSetForReview().execute({ actor: account, setId });
  if (!result.ok) {
    if (result.reason === "forbidden") redirect("/admin?denied=1");
    notFound();
  }
  const { view } = result;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <a href="/admin/sets" className="text-sm text-muted-foreground underline">
        ← 題組
      </a>
      <h1 className="mt-4 font-display text-2xl font-semibold">{view.set.title}</h1>
      <div className="mt-2">
        <StatusTags tags={statusTagsOf(view.set)} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-mono">{view.set.setId}</span> · {view.set.questionCount} 題
        {view.review &&
          ` · 上次審稿 ${view.review.reviewedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`}
      </p>
      <div className="mt-8">
        <ReviewForm
          view={view}
          audioUrl={`/admin/sets/${setId}/audio`}
          action={reviewExamSetAction.bind(null, setId)}
        />
      </div>
    </main>
  );
}
