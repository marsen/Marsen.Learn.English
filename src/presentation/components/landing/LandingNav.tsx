"use client";

import { useState } from "react";
import { LANDING } from "@/presentation/content/landing";
import { HeadphonesIcon } from "./icons";

/** 首頁導覽列：桌機橫排，手機收成選單 */
export function LandingNav({
  examHref,
  loginHref,
}: {
  examHref: string;
  loginHref: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#top" className="flex items-center gap-2 font-semibold text-heading">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary-hover">
            <HeadphonesIcon />
          </span>
          {LANDING.brand}
        </a>
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {LANDING.nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-primary-hover">
              {n.label}
            </a>
          ))}
          <a href={loginHref} className="hover:text-primary-hover">
            {LANDING.login}
          </a>
          <a
            href={examHref}
            className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:scale-105 hover:bg-primary-hover"
          >
            {LANDING.navCta}
          </a>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 md:hidden"
          aria-label="開啟選單"
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
      </nav>
      {open && (
        <div className="border-t border-border px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-3 pt-4">
            {LANDING.nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
                {n.label}
              </a>
            ))}
            <a href={loginHref}>{LANDING.login}</a>
            <a
              href={examHref}
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-center font-medium text-primary-foreground"
            >
              {LANDING.navCta}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
