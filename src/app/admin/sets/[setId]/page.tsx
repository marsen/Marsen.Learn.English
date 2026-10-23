import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { formatFullDateTime } from "@/presentation/lib/format";
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
    <Page>
      <PageHeader
        back={{ href: "/admin/sets", label: "題組" }}
        title={view.set.title}
        description={
          <>
            <div className="mb-2">
              <StatusTags tags={statusTagsOf(view.set)} />
            </div>
            <span className="font-mono">{view.set.setId}</span> · {view.set.questionCount}{" "}
            題{view.review && ` · 上次審稿 ${formatFullDateTime(view.review.reviewedAt)}`}
          </>
        }
      />
      <ReviewForm
        view={view}
        audioUrl={`/admin/sets/${setId}/audio`}
        action={reviewExamSetAction.bind(null, setId)}
      />
    </Page>
  );
}
