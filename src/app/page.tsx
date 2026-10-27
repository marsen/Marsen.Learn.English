import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPage } from "@/presentation/components/landing/LandingPage";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return { title: t("metaTitle") };
}

export default async function HomePage() {
  const account = await getCurrentAccount();
  return (
    <>
      <DocumentTitle id="landing.metaTitle" />
      <LandingPage
        examHref="/exam"
        loginHref="/login"
        dashboardHref={account ? "/admin" : undefined}
      />
    </>
  );
}
