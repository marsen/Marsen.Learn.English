"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { activeHref, type NavItem } from "@/presentation/lib/navigation";
import { useTranslations } from "next-intl";
import { NavIconSvg } from "./NavIcons";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";

type Props = {
  items: NavItem[];
  email: string;
  roleLabel: string;
  logout: () => Promise<void>;
  setLocale: (locale: string) => Promise<void>;
};

/** 登入後的側邊欄：只列出這個帳號有權限的頁面。桌機固定在左邊，手機收成上方選單。 */
export function AppSidebar({ items, email, roleLabel, logout, setLocale }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const active = activeHref(items, pathname);
  const [open, setOpen] = useState(false);

  const links = (["learn", "manage"] as const).map((g) => {
    const group = items.filter((i) => i.group === g);
    if (group.length === 0) return null;
    return (
      <div key={g} className="mb-6">
        <p className="mb-2 px-3 text-xs font-medium tracking-wider text-muted-foreground">
          {t(`nav.groups.${g}`)}
        </p>
        <ul className="grid gap-1">
          {group.map((i) => (
            <li key={i.href}>
              <a
                href={i.href}
                aria-current={active === i.href ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active === i.href
                    ? "bg-primary-soft font-medium text-heading"
                    : "text-foreground/80 hover:bg-muted"
                }`}
              >
                <NavIconSvg name={i.icon} />
                {t(`nav.items.${i.icon}`)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  });

  const footer = (
    <div className="border-t border-border pt-4">
      <p className="truncate px-3 text-sm font-medium text-heading" title={email}>
        {email}
      </p>
      <p className="px-3 text-xs text-muted-foreground">{roleLabel}</p>
      <form action={logout}>
        <button
          type="submit"
          className="mt-3 w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          {t("nav.logout")}
        </button>
      </form>
      <LanguageSwitcher setLocale={setLocale} className="mt-2 px-3" />
    </div>
  );

  const brand = (
    <a href="/" className="flex items-center gap-2 px-3 font-semibold text-heading">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary-hover">
        <NavIconSvg name="exam" />
      </span>
      {t("common.brand")}
    </a>
  );

  return (
    <>
      {/* 桌機 */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface/70 px-3 py-6 md:flex">
        <div className="mb-8">{brand}</div>
        <nav className="flex-1 overflow-y-auto">{links}</nav>
        {footer}
      </aside>

      {/* 手機 */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-2 py-3">
          {brand}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={t("nav.openMenu")}
            aria-expanded={open}
            className="rounded-lg p-2"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        {open && (
          <div className="border-t border-border px-3 py-4">
            <nav onClick={() => setOpen(false)}>{links}</nav>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
