import type { Metadata } from "next";
import { LandingPage } from "@/presentation/components/landing/LandingPage";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";

export const metadata: Metadata = { title: "無限雅思聽力模擬測試" };

export default async function HomePage() {
  const account = await getCurrentAccount();
  return (
    <LandingPage
      examHref="/exam"
      loginHref="/login"
      dashboardHref={account ? "/admin" : undefined}
    />
  );
}
