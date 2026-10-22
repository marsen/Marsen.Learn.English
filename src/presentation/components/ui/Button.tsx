import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

/**
 * 按鈕：全站共用的樣式，新頁面一律用這裡的，不要自己寫 className。
 * - primary：主要動作（送出、開始、上架）
 * - secondary：次要動作（取消、複製、上個月）
 * - danger：會刪東西的確認動作
 */
export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1 rounded-full font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-white text-foreground ring-1 ring-border ring-inset hover:bg-muted",
  danger: "bg-destructive text-white hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-2.5",
};

type Style = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

export function buttonClass({ variant = "primary", size = "md", className }: Style = {}) {
  return [BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(" ");
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: Style & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}

/** 長得像按鈕的連結 */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  ...props
}: Style & { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...props} />
  );
}
