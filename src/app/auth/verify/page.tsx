import type { Metadata } from "next";
import { CardPage } from "@/presentation/components/ui/Page";
import { VerifyForm } from "@/presentation/components/VerifyForm";
import { verifyLoginLinkAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "完成登入", robots: { index: false } };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <CardPage title="完成登入" description="按下按鈕就登入了。">
      <VerifyForm token={token} action={verifyLoginLinkAction} />
    </CardPage>
  );
}
