import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <a href="/admin" className="text-sm text-muted-foreground underline">
        ← 後台
      </a>
      <h1 className="mt-4 mb-2 font-display text-2xl font-semibold">管理權限</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        指定每個帳號的角色。一個帳號可以有多個角色，能用的功能是各角色加起來。不能拿掉自己的管理員角色。
      </p>
      <AccountManager
        accounts={accounts}
        selfId={actor.id}
        setRoles={setAccountRolesAction}
        addAccount={addAccountAction}
      />
    </main>
  );
}
