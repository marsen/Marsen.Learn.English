"use client";

import { useTranslations } from "next-intl";

/**
 * 完整考卷的代號還是 s1- 開頭（setId 是主鍵，不改），老師、管理員看到代號時
 * 旁邊加這個標籤，才不會以為是 Section 1。
 */
export function FullExamBadge() {
  const t = useTranslations("examSet");
  return (
    <span className="ml-1.5 inline-block rounded-full bg-accent-soft px-2 py-0.5 align-middle font-sans text-xs whitespace-nowrap text-accent-hover">
      {t("fullExamBadge")}
    </span>
  );
}
