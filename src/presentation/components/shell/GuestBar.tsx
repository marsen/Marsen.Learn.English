import { ButtonLink } from "@/presentation/components/ui/Button";

/** 路人（沒登入）看考卷時的上方列：品牌與登入 */
export function GuestBar() {
  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <a href="/" className="font-semibold text-heading">
          無限雅思聽力
        </a>
        <ButtonLink href="/login" size="sm">
          登入／註冊
        </ButtonLink>
      </div>
    </header>
  );
}
