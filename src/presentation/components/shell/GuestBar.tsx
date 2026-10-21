/** 路人（沒登入）看考卷時的上方列：品牌與登入 */
export function GuestBar() {
  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <a href="/" className="font-semibold text-heading">
          無限雅思聽力
        </a>
        <a
          href="/login"
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:scale-105 hover:bg-primary-hover"
        >
          登入／註冊
        </a>
      </div>
    </header>
  );
}
