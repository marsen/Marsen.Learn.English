import type { ReactNode } from "react";

/** 清單沒有資料時顯示的框 */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-border bg-white px-5 py-6 text-center text-muted-foreground">
      {children}
    </p>
  );
}
