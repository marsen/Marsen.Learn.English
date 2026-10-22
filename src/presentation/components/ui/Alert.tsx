import type { ReactNode } from "react";

/**
 * 訊息框：error（錯誤）、info（一般通知，例如已儲存、已寄出）。
 * 錯誤一次有好幾條時傳陣列，會排成清單。
 */
export function Alert({
  tone = "info",
  className,
  children,
}: {
  tone?: "info" | "error";
  className?: string;
  children: ReactNode | string[];
}) {
  const color = tone === "error" ? "bg-destructive/10 text-destructive" : "bg-card";
  const cls = ["rounded-lg px-4 py-3 text-sm", color, className]
    .filter(Boolean)
    .join(" ");
  const role = tone === "error" ? "alert" : "status";
  if (Array.isArray(children)) {
    return (
      <ul role={role} className={`${cls} list-disc pl-8`}>
        {children.map((c, i) => (
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
