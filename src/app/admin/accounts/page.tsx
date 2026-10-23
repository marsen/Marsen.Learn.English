import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { AccountManager } from "@/presentation/components/admin/AccountManager";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listAccounts } from "@/infrastructure/di/authContainer";
import { addAccountAction, setAccountRolesAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "管理權限", robots: { index: false } };

export default async function AccountsPage() {
  const actor = await requireAccount("/admin/accounts");
  const accounts = await listAccounts().execute({ actor });
  if (!accounts) redirect("/admin?denied=1");

  return (
    <Page width="lg">
      <PageHeader
        title="管理權限"
        description="指定每個帳號的角色。一個帳號可以有多個角色，能用的功能是各角色加起來。不能拿掉自己的管理員角色。"
      />
      <AccountManager
        accounts={accounts}
        selfId={actor.id}
        setRoles={setAccountRolesAction}
        addAccount={addAccountAction}
      />
    </Page>
  );
}
