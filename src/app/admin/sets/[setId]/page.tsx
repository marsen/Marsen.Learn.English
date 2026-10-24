import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { ReviewMeta } from "@/presentation/components/admin/ReviewMeta";
import { ReviewForm } from "@/presentation/components/admin/ReviewForm";
import { StatusTags } from "@/presentation/components/admin/StatusTags";
import { statusTagsOf } from "@/domain/examSet/statusTags";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { getExamSetForReview } from "@/infrastructure/di/examSetContainer";
import { reviewExamSetAction } from "@/app/actions/examSet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("review");
  return { title: t("metaTitle"), robots: { index: false } };
}

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
    <Page width="lg">
      <DocumentTitle id="review.metaTitle" />
      <PageHeader
        back={{ href: "/admin/sets", label: <Msg id="review.back" /> }}
        title={view.set.title}
        description={
          <>
            <div className="mb-2">
              <StatusTags tags={statusTagsOf(view.set)} />
            </div>
            <ReviewMeta
              setId={view.set.setId}
              questionCount={view.set.questionCount}
              reviewedAt={view.review?.reviewedAt ?? null}
            />
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
