import { AppSidebar } from "@/presentation/components/shell/AppSidebar";
import { GuestBar } from "@/presentation/components/shell/GuestBar";
import { navItemsFor } from "@/presentation/lib/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { logoutAction } from "@/app/actions/auth";
import { setLocaleAction } from "@/app/actions/locale";

/** 登入後的版面：左邊側邊欄＋右邊內容；路人只有上方列。 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) {
    return (
      <>
        <GuestBar setLocale={setLocaleAction} />
        <div className="flex flex-1 flex-col">{children}</div>
      </>
    );
  }
  const t = await getTranslations("roles");
  const roleLabel = account.roles.map((r) => t(r)).join(t("separator")) || t("none");
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AppSidebar
        items={navItemsFor(account.roles)}
        email={account.email}
        roleLabel={roleLabel}
        logout={logoutAction}
        setLocale={setLocaleAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
