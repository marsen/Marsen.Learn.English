import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 頁面外框與標題。新頁面用 <Page> 包起來、<PageHeader> 放標題，
 * 寬度只有三種，不要自己寫 max-w。
 */
const WIDTHS = { sm: "max-w-2xl", md: "max-w-3xl", lg: "max-w-5xl" } as const;

export function Page({
  width = "md",
  children,
}: {
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return (
    <main className={`mx-auto w-full ${WIDTHS[width]} flex-1 px-4 py-12`}>
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 上一層：{ href, label } */
  back?: { href: string; label: string };
  /** 標題右邊的按鈕 */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} className="text-sm text-muted-foreground underline">
          ← {back.label}
        </Link>
      )}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${back ? "mt-4" : ""}`}
      >
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {actions}
      </div>
      {description && (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      )}
    </header>
  );
}

/** 置中的小卡片頁（登入）；footer 放在卡片下方（例如語言切換） */
export function CardPage({
  title,
  description,
  footer,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </main>
  );
}
