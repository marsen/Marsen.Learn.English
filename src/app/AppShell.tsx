import { AppSidebar } from "@/presentation/components/shell/AppSidebar";
import { GuestBar } from "@/presentation/components/shell/GuestBar";
import { DesktopTopBar } from "@/presentation/components/shell/DesktopTopBar";
import { navItemsFor } from "@/presentation/lib/navigation";
import { getCurrentAccount } from "@/infrastructure/auth/currentAccount";
import { logoutAction } from "@/app/actions/auth";

/** 登入後的版面：左邊側邊欄＋右邊內容；路人只有上方列。 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) {
    return (
      <>
        <GuestBar />
        <div className="flex flex-1 flex-col">{children}</div>
      </>
    );
  }
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AppSidebar
        items={navItemsFor(account.roles)}
        email={account.email}
        roles={account.roles}
        logout={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopTopBar />
        {children}
      </div>
    </div>
  );
}
