import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPage } from "@/presentation/components/landing/LandingPage";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { toLandingDemoView } from "@/application/exam/landingDemo";
import landingDemo from "@/presentation/content/landingDemo.json";

/** 首頁示意題（public/landing-demo/，由 pnpm demo:make 產生） */
const DEMO = toLandingDemoView(landingDemo, "/landing-demo/audio.mp3");

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
        demo={DEMO}
      />
    </>
  );
}
