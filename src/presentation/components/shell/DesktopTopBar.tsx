import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";

/**
 * 登入後、電腦版內容區最上面的細上方列：右上角放語言切換（跟手機版、路人上方列、登入頁的位置一致）。
 * 手機版已經有自己的上方列（在 AppSidebar 裡），這條只在 md 以上顯示。
 */
export function DesktopTopBar() {
  return (
    <div className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-background/90 px-4 backdrop-blur md:flex">
      <LanguageSwitcher />
    </div>
  );
}
