import type { Metadata } from "next";
import { LandingPage } from "@/presentation/components/landing/LandingPage";

export const metadata: Metadata = { title: "無限雅思聽力模擬測試" };

export default function HomePage() {
  return <LandingPage examHref="/exam" loginHref="/login" />;
}
