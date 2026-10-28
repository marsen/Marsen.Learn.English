import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { ReviewLog } from "@/presentation/components/admin/ReviewLog";
import { requirePermission } from "@/infrastructure/auth/currentAccount";
import { getReviewLog } from "@/infrastructure/di/examSetContainer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reviewLog");
  return { title: t("title"), robots: { index: false } };
}

export default async function ReviewLogPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const actor = await requirePermission("viewReviewLog");
  const { month } = await searchParams;
  const view = await getReviewLog().execute({ actor, month, now: new Date() });
  if (!view) redirect("/admin?denied=1");

  return (
    <Page width="lg">
      <DocumentTitle id="reviewLog.title" />
      <PageHeader
        title={<Msg id="reviewLog.title" />}
        description={<Msg id="reviewLog.description" />}
      />
      <ReviewLog view={view} />
    </Page>
  );
}
