"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LANDING } from "@/presentation/content/landing";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";
import { HeadphonesIcon } from "./icons";

/** 首頁導覽列：桌機橫排，手機收成選單；語言切換在兩種版面都一直看得到 */
export function LandingNav({
  examHref,
  loginHref,
  dashboardHref,
}: {
  examHref: string;
  loginHref: string;
  /** 已登入時給：「登入」換成「我的總覽」，「免費試寫」換成「開始練習」 */
  dashboardHref?: string;
}) {
  const t = useTranslations();
  const account = dashboardHref
    ? { href: dashboardHref, label: t("landing.dashboard") }
    : { href: loginHref, label: t("landing.login") };
  const ctaLabel = dashboardHref ? t("landing.navCtaMember") : t("landing.navCta");
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#top" className="flex items-center gap-2 font-semibold text-heading">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary-hover">
            <HeadphonesIcon />
          </span>
          {t("common.brand")}
        </a>
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {LANDING.nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-primary-hover">
              {t(`landing.nav.${n.key}`)}
            </a>
          ))}
          <LanguageSwitcher />
          <a href={account.href} className="hover:text-primary-hover">
            {account.label}
          </a>
          <a
            href={examHref}
            className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:scale-105 hover:bg-primary-hover"
          >
            {ctaLabel}
          </a>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-2"
            aria-label={t("nav.openMenu")}
            aria-expanded={open}
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
      </nav>
      {open && (
        <div className="border-t border-border px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-3 pt-4">
            {LANDING.nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
                {t(`landing.nav.${n.key}`)}
              </a>
            ))}
            <a href={account.href}>{account.label}</a>
            <a
              href={examHref}
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-center font-medium text-primary-foreground"
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
