"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES } from "@/domain/i18n/locale";

type Props = {
  /** Server Action：把選到的語言記下來 */
  setLocale: (locale: string) => Promise<void>;
  className?: string;
};

/** 介面語言切換：選了就記住，重新整理畫面 */
export function LanguageSwitcher({ setLocale, className }: Props) {
  const t = useTranslations("common");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={["flex items-center gap-2 text-sm", className].filter(Boolean).join(" ")}
    >
      <span className="text-muted-foreground">{t("language")}</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
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
