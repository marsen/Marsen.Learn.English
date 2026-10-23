import type { ReactNode } from "react";

/**
 * 訊息框：error（錯誤）、info（一般通知，例如已儲存、已寄出）。
 * 一次有好幾條訊息時用 items，會排成清單。
 * size：md 用在需要特別醒目的訊息（例如登入碼輸錯）。className 不要放字級，會跟 size 打架。
 */
export function Alert({
  tone = "info",
  size = "sm",
  className,
  items,
  children,
}: {
  tone?: "info" | "error";
  size?: "sm" | "md";
  className?: string;
  items?: string[];
  children?: ReactNode;
}) {
  const color = tone === "error" ? "bg-destructive/10 text-destructive" : "bg-card";
  const cls = [
    "rounded-lg px-4 py-3",
    size === "md" ? "text-base" : "text-sm",
    color,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const role = tone === "error" ? "alert" : "status";
  if (items) {
    return (
      <ul role={role} className={`${cls} list-disc pl-8`}>
        {items.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    );
  }
  return (
    <p role={role} className={cls}>
      {children}
    </p>
  );
}
