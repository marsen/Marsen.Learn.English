import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * 表格：外框、橫向捲動、欄位間距都在這裡統一。
 * 用法：<Table head={<><Th>標題</Th>…</>}>{rows.map(r => <Tr><Td>…</Td></Tr>)}</Table>
 */
export function Table({ head, children }: { head?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        {head && (
          <thead className="border-b border-border text-muted-foreground">
            <tr>{head}</tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

type Align = { align?: "left" | "right" };

export function Th({
  align,
  className,
  ...props
}: Align & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={["px-4 py-3 font-medium", align === "right" && "text-right", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function Tr({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <tr
      className={["border-b border-border last:border-0", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </tr>
  );
}

export function Td({
  align,
  className,
  ...props
}: Align & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={["px-4 py-3", align === "right" && "text-right", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
