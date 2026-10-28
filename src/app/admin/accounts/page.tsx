import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader } from "@/presentation/components/ui/Page";
import { Msg } from "@/presentation/components/Msg";
import { DocumentTitle } from "@/presentation/components/DocumentTitle";
import { AccountManager } from "@/presentation/components/admin/AccountManager";
import { requireAccount } from "@/infrastructure/auth/currentAccount";
import { listAccounts } from "@/infrastructure/di/authContainer";
import { addAccountAction, setAccountRolesAction } from "@/app/actions/account";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts");
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountsPage() {
  const actor = await requireAccount("/admin/accounts");
  const accounts = await listAccounts().execute({ actor });
  if (!accounts) redirect("/admin?denied=1");

  return (
    <Page width="lg">
      <DocumentTitle id="accounts.title" />
      <PageHeader
        title={<Msg id="accounts.title" />}
        description={<Msg id="accounts.description" />}
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
