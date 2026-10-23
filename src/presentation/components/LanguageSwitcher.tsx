"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES } from "@/domain/i18n/locale";

type Props = {
  /** Server Action：把選到的語言記下來 */
  setLocale: (locale: string) => Promise<void>;
};

/** 按鈕上顯示的目前語言（用該語言自己的寫法，看不懂介面的人也認得） */
const SHORT: Record<string, string> = { "zh-TW": "中文", en: "EN" };

/**
 * 介面語言切換：地球圖示＋目前語言。
 * 底層是透明的原生下拉選單蓋在按鈕上：手機點了會跳出系統的選擇器，字大好點、不會被畫面邊緣切掉。
 */
export function LanguageSwitcher({ setLocale }: Props) {
  const t = useTranslations("common");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={`relative inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-foreground/80 hover:bg-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
        pending ? "opacity-60" : ""
      }`}
    >
      <GlobeIcon />
      <span className="font-medium">{SHORT[current] ?? current}</span>
      <select
        aria-label={t("language")}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`languageNames.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
